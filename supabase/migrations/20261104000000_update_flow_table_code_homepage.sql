-- ==============================================================================
-- MANASU RESTAURANT: Migration 20261104000000
-- Public Homepage Settings, Direct-to-Kitchen Flow, & Table Code Authentication
-- ==============================================================================

-- 1. Extend Settings with restaurant details, photos, and large order threshold
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_text TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS maps_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS large_order_threshold_paise INT DEFAULT 500000;

-- 2. Extend Table Sessions with 4-digit code and rate-limiting
ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS access_code VARCHAR(4),
  ADD COLUMN IF NOT EXISTS code_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS code_locked_until TIMESTAMPTZ;

-- 3. Table Session Joined Devices (Tracks phones authorized at this table)
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

-- 4. Update Orders status constraint & add idempotency / cancellation fields
-- Convert existing orders to valid new statuses
UPDATE public.orders SET status = 'placed' WHERE status = 'pending';
UPDATE public.orders SET status = 'preparing' WHERE status = 'approved';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('placed', 'preparing', 'ready', 'served', 'cancelled'));

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'placed';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS needs_confirmation BOOLEAN NOT NULL DEFAULT false;

-- 5. RLS Policies
ALTER TABLE public.table_session_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full access table_session_devices" ON public.table_session_devices;
CREATE POLICY "Owner full access table_session_devices"
  ON public.table_session_devices FOR ALL
  USING (public.is_owner());

DROP POLICY IF EXISTS "Waiter full access table_session_devices" ON public.table_session_devices;
CREATE POLICY "Waiter full access table_session_devices"
  ON public.table_session_devices FOR ALL
  USING (public.is_waiter());

-- Allow public read of settings for the public homepage (read-only)
DROP POLICY IF EXISTS "Public can view settings" ON public.settings;
CREATE POLICY "Public can view settings"
  ON public.settings FOR SELECT
  USING (true);

-- Allow public read of active menu items and categories for public homepage
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
  ON public.categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can view menu_items" ON public.menu_items;
CREATE POLICY "Public can view menu_items"
  ON public.menu_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can view combos" ON public.combos;
CREATE POLICY "Public can view combos"
  ON public.combos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can view combo_items" ON public.combo_items;
CREATE POLICY "Public can view combo_items"
  ON public.combo_items FOR SELECT
  USING (true);

-- Ensure public CANNOT read dining_tables, table_sessions, orders, bills
DROP POLICY IF EXISTS "Public cannot view tables" ON public.dining_tables;
DROP POLICY IF EXISTS "Public cannot view table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Public cannot view orders" ON public.orders;
DROP POLICY IF EXISTS "Public cannot view bills" ON public.bills;
