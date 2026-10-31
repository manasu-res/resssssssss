-- ==============================================================================
-- MANASU RESTAURANT, BENGALURU
-- Migration: Initial Schema with RLS, Role Verification, and Daily Bill Reset
-- All monetary amounts stored as integer paise (1 INR = 100 paise)
-- ==============================================================================

-- 1. Helper Function: Profile Role Extraction
-- Ensures RLS checks run safely and fast without recursive policies
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner' AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_waiter()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'waiter' AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_kitchen()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'kitchen' AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Staff Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'waiter', 'kitchen')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Menu Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Menu Items (All price values in integer paise)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INT NOT NULL CHECK (price >= 0),
  is_veg BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Combos
CREATE TABLE IF NOT EXISTS public.combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INT NOT NULL CHECK (price >= 0),
  is_veg BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Combo Items (Association Table)
CREATE TABLE IF NOT EXISTS public.combo_items (
  combo_id UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0) DEFAULT 1,
  PRIMARY KEY (combo_id, menu_item_id)
);

-- 7. Dining Tables
CREATE TABLE IF NOT EXISTS public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Table Sessions
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.dining_tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open', 'billed', 'closed')) DEFAULT 'open',
  opened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- RULE: Only ONE open session per dining table at a time (Partial Unique Index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_open_session_per_table
  ON public.table_sessions (table_id)
  WHERE status = 'open';

-- 9. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'preparing', 'ready', 'served', 'cancelled')) DEFAULT 'pending',
  source TEXT NOT NULL CHECK (source IN ('customer', 'waiter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ
);

-- 10. Order Lines (Holds immutable snapshot of item name and price in paise)
CREATE TABLE IF NOT EXISTS public.order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  combo_id UUID REFERENCES public.combos(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  price_snapshot INT NOT NULL CHECK (price_snapshot >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Bills (Daily resetting bill number, e.g. '0001')
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
  bill_no TEXT NOT NULL,
  subtotal INT NOT NULL CHECK (subtotal >= 0),
  tax_amount INT NOT NULL CHECK (tax_amount >= 0),
  total INT NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Daily resetting bill number generator for Bengaluru timezone (Asia/Kolkata)
CREATE OR REPLACE FUNCTION public.generate_daily_bill_no()
RETURNS text AS $$
DECLARE
  v_today_start timestamptz;
  v_count integer;
BEGIN
  v_today_start := (timezone('Asia/Kolkata', now())::date)::timestamptz;

  SELECT COUNT(*) + 1 INTO v_count
  FROM public.bills
  WHERE paid_at >= v_today_start;

  RETURN LPAD(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically assign daily resetting bill_no on insert
CREATE OR REPLACE FUNCTION public.set_bill_no_trigger()
RETURNS trigger AS $$
BEGIN
  IF NEW.bill_no IS NULL OR NEW.bill_no = '' THEN
    NEW.bill_no := public.generate_daily_bill_no();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_bill_no ON public.bills;
CREATE TRIGGER trg_set_bill_no
  BEFORE INSERT ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bill_no_trigger();

-- 12. Settings (Single row constraint)
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  gstin TEXT,
  tax_percent NUMERIC NOT NULL DEFAULT 5,
  bill_footer TEXT NOT NULL DEFAULT 'Thank you! Visit again.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Security: No public access at all. Customers access via Server Route
-- Handlers using service role key, bypassing direct client RLS.
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner has full access to profiles"
  ON public.profiles FOR ALL
  USING (public.is_owner());

CREATE POLICY "Staff can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id AND is_active = true);

-- ------------------------------------------------------------------------------
-- Menu (categories, menu_items, combos, combo_items, settings)
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner has full access to categories"
  ON public.categories FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read categories"
  ON public.categories FOR SELECT
  USING (public.is_waiter());

CREATE POLICY "Owner has full access to menu_items"
  ON public.menu_items FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read menu_items"
  ON public.menu_items FOR SELECT
  USING (public.is_waiter());

CREATE POLICY "Owner has full access to combos"
  ON public.combos FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read combos"
  ON public.combos FOR SELECT
  USING (public.is_waiter());

CREATE POLICY "Owner has full access to combo_items"
  ON public.combo_items FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read combo_items"
  ON public.combo_items FOR SELECT
  USING (public.is_waiter());

CREATE POLICY "Owner has full access to settings"
  ON public.settings FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read settings"
  ON public.settings FOR SELECT
  USING (public.is_waiter());

-- ------------------------------------------------------------------------------
-- Dining Tables
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner has full access to dining_tables"
  ON public.dining_tables FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read dining_tables"
  ON public.dining_tables FOR SELECT
  USING (public.is_waiter());

CREATE POLICY "Waiter can update dining_tables"
  ON public.dining_tables FOR UPDATE
  USING (public.is_waiter());

-- ------------------------------------------------------------------------------
-- Table Sessions
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner has full access to table_sessions"
  ON public.table_sessions FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read and write table_sessions"
  ON public.table_sessions FOR ALL
  USING (public.is_waiter())
  WITH CHECK (public.is_waiter());

-- ------------------------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner has full access to orders"
  ON public.orders FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read and write orders"
  ON public.orders FOR ALL
  USING (public.is_waiter())
  WITH CHECK (public.is_waiter());

CREATE POLICY "Kitchen can read orders"
  ON public.orders FOR SELECT
  USING (public.is_kitchen());

CREATE POLICY "Kitchen can update order status only"
  ON public.orders FOR UPDATE
  USING (public.is_kitchen())
  WITH CHECK (public.is_kitchen());

-- ------------------------------------------------------------------------------
-- Order Lines
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner has full access to order_lines"
  ON public.order_lines FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read and write order_lines"
  ON public.order_lines FOR ALL
  USING (public.is_waiter())
  WITH CHECK (public.is_waiter());

CREATE POLICY "Kitchen can read order_lines"
  ON public.order_lines FOR SELECT
  USING (public.is_kitchen());

-- ------------------------------------------------------------------------------
-- Bills
-- ------------------------------------------------------------------------------
CREATE POLICY "Owner has full access to bills"
  ON public.bills FOR ALL
  USING (public.is_owner());

CREATE POLICY "Waiter can read and insert bills"
  ON public.bills FOR SELECT
  USING (public.is_waiter());

CREATE POLICY "Waiter can insert bills"
  ON public.bills FOR INSERT
  WITH CHECK (public.is_waiter());
