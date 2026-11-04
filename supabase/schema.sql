-- ==============================================================================
-- MANASU RESTAURANT, BENGALURU
-- Complete Master Schema for Supabase
-- Run this script in: Supabase Dashboard > SQL Editor > New Query > Run
-- ==============================================================================

-- 1. Staff Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'waiter', 'kitchen')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Menu Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Menu Items (All price values in integer paise: ₹1 = 100 paise)
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

-- 4. Combos
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

-- 5. Combo Items (Association Table)
CREATE TABLE IF NOT EXISTS public.combo_items (
  combo_id UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0) DEFAULT 1,
  PRIMARY KEY (combo_id, menu_item_id)
);

-- 6. Dining Tables
CREATE TABLE IF NOT EXISTS public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Table Sessions
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.dining_tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open', 'billed', 'closed')) DEFAULT 'open',
  access_code VARCHAR(4),
  code_attempts INT DEFAULT 0,
  code_locked_until TIMESTAMPTZ,
  opened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Rule: Only ONE open session per dining table at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_open_session_per_table
  ON public.table_sessions (table_id)
  WHERE status = 'open';

-- 7b. Table Session Devices (Tracks customer phones authorized at a table)
CREATE TABLE IF NOT EXISTS public.table_session_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_devices_session_active
  ON public.table_session_devices (session_id, device_id, is_active);

-- 8. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  order_number INT,
  status TEXT NOT NULL CHECK (status IN ('placed', 'preparing', 'ready', 'served', 'cancelled')) DEFAULT 'placed',
  source TEXT NOT NULL CHECK (source IN ('customer', 'waiter')),
  notes TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  needs_confirmation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  cancel_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ
);

-- 9. Order Lines (Holds immutable snapshot of item name and price in paise)
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

-- 10. Bills (Daily resetting bill number, e.g. '0001')
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
  bill_no TEXT NOT NULL,
  table_label TEXT NOT NULL DEFAULT '',
  subtotal INT NOT NULL CHECK (subtotal >= 0),
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  tax_amount INT NOT NULL CHECK (tax_amount >= 0) DEFAULT 0,
  discount_amount INT NOT NULL CHECK (discount_amount >= 0) DEFAULT 0,
  total INT NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
  gstin TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'cancelled')),
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 11. Settings (Single row constraint)
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  tagline TEXT DEFAULT '',
  about_text TEXT DEFAULT '',
  opening_hours TEXT DEFAULT '',
  maps_url TEXT DEFAULT '',
  photos JSONB DEFAULT '[]'::jsonb,
  large_order_threshold_paise INT DEFAULT 500000,
  gstin TEXT,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  bill_footer TEXT NOT NULL DEFAULT 'Thank you! Visit again.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- HELPER FUNCTIONS & TRIGGERS (Created after tables are in place)
-- ==============================================================================

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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
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
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Owner has full access to profiles" ON public.profiles;
CREATE POLICY "Owner has full access to profiles"
  ON public.profiles FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Staff can view their own profile" ON public.profiles;
CREATE POLICY "Staff can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id AND is_active = true);

-- Categories Policies
DROP POLICY IF EXISTS "Owner has full access to categories" ON public.categories;
CREATE POLICY "Owner has full access to categories"
  ON public.categories FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read categories" ON public.categories;
CREATE POLICY "Waiter can read categories"
  ON public.categories FOR SELECT
  USING (public.is_waiter());

-- Menu Items Policies
DROP POLICY IF EXISTS "Owner has full access to menu_items" ON public.menu_items;
CREATE POLICY "Owner has full access to menu_items"
  ON public.menu_items FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read menu_items" ON public.menu_items;
CREATE POLICY "Waiter can read menu_items"
  ON public.menu_items FOR SELECT
  USING (public.is_waiter());

-- Combos Policies
DROP POLICY IF EXISTS "Owner has full access to combos" ON public.combos;
CREATE POLICY "Owner has full access to combos"
  ON public.combos FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read combos" ON public.combos;
CREATE POLICY "Waiter can read combos"
  ON public.combos FOR SELECT
  USING (public.is_waiter());

-- Combo Items Policies
DROP POLICY IF EXISTS "Owner has full access to combo_items" ON public.combo_items;
CREATE POLICY "Owner has full access to combo_items"
  ON public.combo_items FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read combo_items" ON public.combo_items;
CREATE POLICY "Waiter can read combo_items"
  ON public.combo_items FOR SELECT
  USING (public.is_waiter());

-- Settings Policies
DROP POLICY IF EXISTS "Owner has full access to settings" ON public.settings;
CREATE POLICY "Owner has full access to settings"
  ON public.settings FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read settings" ON public.settings;
CREATE POLICY "Waiter can read settings"
  ON public.settings FOR SELECT
  USING (public.is_waiter());

-- Dining Tables Policies
DROP POLICY IF EXISTS "Owner has full access to dining_tables" ON public.dining_tables;
CREATE POLICY "Owner has full access to dining_tables"
  ON public.dining_tables FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read dining_tables" ON public.dining_tables;
CREATE POLICY "Waiter can read dining_tables"
  ON public.dining_tables FOR SELECT
  USING (public.is_waiter());

DROP POLICY IF EXISTS "Waiter can update dining_tables" ON public.dining_tables;
CREATE POLICY "Waiter can update dining_tables"
  ON public.dining_tables FOR UPDATE
  USING (public.is_waiter());

-- Table Sessions Policies
DROP POLICY IF EXISTS "Owner has full access to table_sessions" ON public.table_sessions;
CREATE POLICY "Owner has full access to table_sessions"
  ON public.table_sessions FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read and write table_sessions" ON public.table_sessions;
CREATE POLICY "Waiter can read and write table_sessions"
  ON public.table_sessions FOR ALL
  USING (public.is_waiter())
  WITH CHECK (public.is_waiter());

-- Orders Policies
DROP POLICY IF EXISTS "Owner has full access to orders" ON public.orders;
CREATE POLICY "Owner has full access to orders"
  ON public.orders FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read and write orders" ON public.orders;
CREATE POLICY "Waiter can read and write orders"
  ON public.orders FOR ALL
  USING (public.is_waiter())
  WITH CHECK (public.is_waiter());

DROP POLICY IF EXISTS "Kitchen can read orders" ON public.orders;
CREATE POLICY "Kitchen can read orders"
  ON public.orders FOR SELECT
  USING (public.is_kitchen());

DROP POLICY IF EXISTS "Kitchen can update order status only" ON public.orders;
CREATE POLICY "Kitchen can update order status only"
  ON public.orders FOR UPDATE
  USING (public.is_kitchen())
  WITH CHECK (public.is_kitchen());

-- Order Lines Policies
DROP POLICY IF EXISTS "Owner has full access to order_lines" ON public.order_lines;
CREATE POLICY "Owner has full access to order_lines"
  ON public.order_lines FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read and write order_lines" ON public.order_lines;
CREATE POLICY "Waiter can read and write order_lines"
  ON public.order_lines FOR ALL
  USING (public.is_waiter())
  WITH CHECK (public.is_waiter());

DROP POLICY IF EXISTS "Kitchen can read order_lines" ON public.order_lines;
CREATE POLICY "Kitchen can read order_lines"
  ON public.order_lines FOR SELECT
  USING (public.is_kitchen());

-- Bills Policies
DROP POLICY IF EXISTS "Owner has full access to bills" ON public.bills;
CREATE POLICY "Owner has full access to bills"
  ON public.bills FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter can read bills" ON public.bills;
CREATE POLICY "Waiter can read bills"
  ON public.bills FOR SELECT
  USING (public.is_waiter());

DROP POLICY IF EXISTS "Waiter can insert bills" ON public.bills;
CREATE POLICY "Waiter can insert bills"
  ON public.bills FOR INSERT
  WITH CHECK (public.is_waiter());

-- Audit Logs Policies
DROP POLICY IF EXISTS "Owner has full access to audit_logs" ON public.audit_logs;
CREATE POLICY "Owner has full access to audit_logs"
  ON public.audit_logs FOR ALL
  USING (public.is_owner());

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dining_tables;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- INITIAL DEFAULT DATA
-- ==============================================================================

-- 1. Restaurant Settings
INSERT INTO public.settings (id, restaurant_name, address, phone, gstin, tax_percent, bill_footer)
VALUES (
  1,
  'Manasu Restaurant',
  '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
  '+91 80 2520 1980',
  '29AABCM8291Q1ZP',
  0.0,
  'Thank you for dining at Manasu! Visit again.'
)
ON CONFLICT (id) DO UPDATE SET
  restaurant_name = EXCLUDED.restaurant_name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone;

-- 2. Initial Tables
INSERT INTO public.dining_tables (label, qr_token, is_enabled)
VALUES
  ('Table 1', 'tbl-manasu-01', true),
  ('Table 2', 'tbl-manasu-02', true),
  ('Table 3', 'tbl-manasu-03', true),
  ('Table 4', 'tbl-manasu-04', true),
  ('Table 5', 'tbl-manasu-05', true),
  ('Table 6', 'tbl-manasu-06', true)
ON CONFLICT (label) DO NOTHING;

-- 3. Initial Owner Profile (Links to auth.users if already registered)
INSERT INTO public.profiles (id, name, role, is_active)
SELECT id, 'Owner', 'owner', true
FROM auth.users
WHERE email = 'manasurestaurant@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'owner', is_active = true;

-- 4. Initial Categories
INSERT INTO public.categories (id, name, sort_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Tiffins & Breakfast', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Bengaluru Starters & Roasts', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Biryani & Traditional Meals', 3)
ON CONFLICT (id) DO NOTHING;

-- 5. Initial Menu Items (Prices in integer paise: 100 paise = ₹1)
INSERT INTO public.menu_items (id, category_id, name, description, price, is_veg, is_available, sort_order)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Davangere Benne Dosa', 'Crisp butter dosa served with spicy potato palya and fresh coconut chutney', 9500, true, true, 1),
  ('a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Thatte Idli with Crispy Vada', 'Steamed plate idli steeped in ghee podi with a crunchy medu vada', 8000, true, true, 2),
  ('a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'Bisi Bele Bath', 'Slow-cooked spiced rice, lentils, and country vegetables tempered with pure ghee', 8500, true, true, 3),
  ('a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'Chow Chow Bath', 'Classic Bengaluru duo: spicy khara bath paired with sweet pineapple kesari bath', 9000, true, true, 4),
  ('a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'Degree Filter Coffee', 'Strong chicory-blended decoction frothed with whole milk in a brass davara', 3500, true, true, 5),
  ('a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000002', 'Kundapura Chicken Ghee Roast', 'Tender chicken tossed in Byadgi chilli paste and slow-roasted in desi ghee', 26000, false, true, 1),
  ('a1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000002', 'Mutton Pepper Sukka', 'Slow-cooked local mutton with black pepper, curry leaves, and toasted coconut', 32000, false, true, 2),
  ('a1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000002', 'Crispy Babycorn Pepper Fry', 'Fresh babycorn flash-fried with crushed black pepper and green chillies', 17000, true, true, 3),
  ('a1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000002', 'Mushroom Ghee Roast', 'Button mushrooms sauteed in rich Mangalorean red masala and pure ghee', 21000, true, true, 4),
  ('a1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000003', 'Shivaji Military Donne Biryani', 'Seeraga Samba rice infused with mint, coriander, and country chicken', 24000, false, true, 1),
  ('a1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000003', 'Mutton Donne Biryani', 'Aromatic Donne Biryani layered with succulent tender mutton pieces', 31000, false, true, 2),
  ('a1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000003', 'North Karnataka Jowar Roti Oota', 'Two hot jolada rotis with yennegai brinjal curry, jhunka, and shenga podi', 18000, true, true, 3)
ON CONFLICT (id) DO NOTHING;

-- 6. Initial Combos
INSERT INTO public.combos (id, name, description, price, is_veg, is_available, sort_order)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'South Bengaluru Breakfast Combo', '1 Thatte Idli with Crispy Vada paired with hot authentic Degree Filter Coffee', 11000, true, true, 1),
  ('b1000000-0000-0000-0000-000000000002', 'Military Donne Biryani Feast', '1 Chicken Donne Biryani paired with Kundapura Chicken Ghee Roast', 38000, false, true, 2)
ON CONFLICT (id) DO NOTHING;

-- Combo Items Association
INSERT INTO public.combo_items (combo_id, menu_item_id, quantity)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 1),
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 1),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000010', 1),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', 1)
ON CONFLICT (combo_id, menu_item_id) DO NOTHING;
