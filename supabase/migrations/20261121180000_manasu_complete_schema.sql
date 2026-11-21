-- ==============================================================================
-- MANASU DIGITAL — PRODUCTION DATABASE FOUNDATION MIGRATION
-- Migration: 20261121180000_manasu_complete_schema.sql
-- Description: Creates customer_sessions, menu_item_addons, order_item_addons,
--              table_bills, bill_items, payments, and notifications tables with RLS.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure profiles has 'manager' role support if required
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen'));
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- 2. Customer Sessions (Multi-Person Group Ordering at a Single Table)
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  device_token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_active
  ON public.customer_sessions (table_session_id, device_token, is_active);

-- 3. Add customer_session_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_session_id'
  ) THEN
    ALTER TABLE public.orders 
      ADD COLUMN customer_session_id UUID REFERENCES public.customer_sessions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'placed_by_waiter_id'
  ) THEN
    ALTER TABLE public.orders 
      ADD COLUMN placed_by_waiter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Menu Item Add-ons (Customizations: Extra Salan, Raita, Boiled Egg, etc.)
CREATE TABLE IF NOT EXISTS public.menu_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_paise INT NOT NULL CHECK (price_paise >= 0) DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_addons_item
  ON public.menu_item_addons (menu_item_id, is_available);

-- 5. Order Item Add-ons (Snapshots of selected customizations attached to order lines)
CREATE TABLE IF NOT EXISTS public.order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id UUID NOT NULL REFERENCES public.order_lines(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES public.menu_item_addons(id) ON DELETE SET NULL,
  addon_name_snapshot TEXT NOT NULL,
  addon_price_paise_snapshot INT NOT NULL CHECK (addon_price_paise_snapshot >= 0) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Table Bills (Supports Combined Table Bill or Split Invoices)
CREATE TABLE IF NOT EXISTS public.table_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
  customer_session_id UUID REFERENCES public.customer_sessions(id) ON DELETE SET NULL,
  bill_number TEXT NOT NULL UNIQUE,
  subtotal_paise INT NOT NULL CHECK (subtotal_paise >= 0),
  tax_percent NUMERIC NOT NULL DEFAULT 5.0,
  tax_amount_paise INT NOT NULL CHECK (tax_amount_paise >= 0) DEFAULT 0,
  service_charge_paise INT NOT NULL CHECK (service_charge_paise >= 0) DEFAULT 0,
  discount_paise INT NOT NULL CHECK (discount_paise >= 0) DEFAULT 0,
  total_paise INT NOT NULL CHECK (total_paise >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_table_bills_session
  ON public.table_bills (table_session_id, payment_status);

-- 7. Bill Items (Itemized accounting lines on the bill)
CREATE TABLE IF NOT EXISTS public.bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.table_bills(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES public.order_lines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price_paise INT NOT NULL CHECK (unit_price_paise >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  total_price_paise INT NOT NULL CHECK (total_price_paise >= 0)
);

-- 8. Payments (Cash, UPI, Razorpay)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.table_bills(id) ON DELETE RESTRICT,
  amount_paise INT NOT NULL CHECK (amount_paise > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'razorpay')),
  gateway_payment_id TEXT,
  gateway_order_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('initiated', 'success', 'failed', 'refunded')) DEFAULT 'initiated',
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Notifications (Live alert notifications across roles)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_role TEXT NOT NULL CHECK (target_role IN ('waiter', 'kitchen', 'manager', 'owner')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_role_read
  ON public.notifications (target_role, is_read, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Customer Sessions Policies
CREATE POLICY "Public can create and join customer session"
  ON public.customer_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Customers can read sessions for their active table"
  ON public.customer_sessions FOR SELECT
  USING (true);

CREATE POLICY "Staff can view and manage customer sessions"
  ON public.customer_sessions FOR ALL
  TO authenticated
  USING (true);

-- Menu Item Add-ons Policies
CREATE POLICY "Public can view available menu addons"
  ON public.menu_item_addons FOR SELECT
  USING (is_available = true);

CREATE POLICY "Staff have full access to menu addons"
  ON public.menu_item_addons FOR ALL
  TO authenticated
  USING (true);

-- Order Item Add-ons Policies
CREATE POLICY "Public can insert order item addons"
  ON public.order_item_addons FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Order item addons can be viewed"
  ON public.order_item_addons FOR SELECT
  USING (true);

-- Table Bills & Items Policies
CREATE POLICY "Staff can view and manage bills"
  ON public.table_bills FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Staff can view and manage bill items"
  ON public.bill_items FOR ALL
  TO authenticated
  USING (true);

-- Payments Policies
CREATE POLICY "Staff can view and record payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (true);

-- Notifications Policies
CREATE POLICY "Staff can view their notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (true);
