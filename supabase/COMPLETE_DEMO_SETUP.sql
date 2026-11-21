-- ==============================================================================
-- MANASU DIGITAL — ONE-CLICK SUPABASE SETUP & DEMO SEED
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project: gshbgxtjdeznihddfdzb
-- 3. Click "SQL Editor" on the left menu -> Click "New query"
-- 4. Paste this entire script into the editor and click "Run" (Ctrl+Enter)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- PART 1: ENSURE BASE TABLES & EXTEND COLUMNS IF MISSING
-- ------------------------------------------------------------------------------

-- 1. Settings Table & Missing Columns
CREATE TABLE IF NOT EXISTS public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name TEXT NOT NULL DEFAULT 'Manasu Restaurant',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  gstin TEXT,
  tax_percent NUMERIC NOT NULL DEFAULT 5.0,
  bill_footer TEXT NOT NULL DEFAULT 'Thank you! Visit again.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_text TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS maps_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS large_order_threshold_paise INT DEFAULT 500000;

-- 2. Dining Tables Table
CREATE TABLE IF NOT EXISTS public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table Sessions Table
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.dining_tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open', 'billed', 'closed')) DEFAULT 'open',
  opened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS access_code VARCHAR(4),
  ADD COLUMN IF NOT EXISTS code_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS code_locked_until TIMESTAMPTZ;

-- 4. Table Session Devices Table
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

-- 5. Customer Sessions (Multi-Person Group Ordering)
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

-- 6. Orders Table & Extensions
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  order_number INT,
  status TEXT NOT NULL DEFAULT 'placed',
  source TEXT NOT NULL CHECK (source IN ('customer', 'waiter')) DEFAULT 'customer',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_session_id UUID REFERENCES public.customer_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placed_by_waiter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS needs_confirmation BOOLEAN NOT NULL DEFAULT false;

-- Ensure orders_status_check permits all valid workflow statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'placed', 'accepted', 'approved', 'preparing', 'ready', 'served', 'cancelled'));

-- Ensure profiles role check permits manager
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'manager', 'waiter', 'kitchen'));
  END IF;
END $$;

-- 7. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Menu Items Table
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

-- 9. Order Lines Table
CREATE TABLE IF NOT EXISTS public.order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  price_snapshot INT NOT NULL CHECK (price_snapshot >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Menu Item Add-ons Table
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

-- 11. Order Item Add-ons Table
CREATE TABLE IF NOT EXISTS public.order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id UUID NOT NULL REFERENCES public.order_lines(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES public.menu_item_addons(id) ON DELETE SET NULL,
  addon_name_snapshot TEXT NOT NULL,
  addon_price_paise_snapshot INT NOT NULL CHECK (addon_price_paise_snapshot >= 0) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Table Bills Table
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

-- 13. Bill Items Table
CREATE TABLE IF NOT EXISTS public.bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.table_bills(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES public.order_lines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price_paise INT NOT NULL CHECK (unit_price_paise >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  total_price_paise INT NOT NULL CHECK (total_price_paise >= 0)
);

-- 14. Payments Table
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

-- 15. Notifications Table
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


-- ------------------------------------------------------------------------------
-- PART 2: ROW LEVEL SECURITY POLICIES (SAFE & IDEMPOTENT)
-- ------------------------------------------------------------------------------

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_session_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Settings
  DROP POLICY IF EXISTS "Public can view settings" ON public.settings;
  CREATE POLICY "Public can view settings" ON public.settings FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Staff full access settings" ON public.settings;
  CREATE POLICY "Staff full access settings" ON public.settings FOR ALL TO authenticated USING (true);

  -- Categories & Menu Items
  DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
  CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Staff full access categories" ON public.categories;
  CREATE POLICY "Staff full access categories" ON public.categories FOR ALL TO authenticated USING (true);

  DROP POLICY IF EXISTS "Public can view menu_items" ON public.menu_items;
  CREATE POLICY "Public can view menu_items" ON public.menu_items FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Staff full access menu_items" ON public.menu_items;
  CREATE POLICY "Staff full access menu_items" ON public.menu_items FOR ALL TO authenticated USING (true);

  -- Customer Sessions
  DROP POLICY IF EXISTS "Public can create and join customer session" ON public.customer_sessions;
  CREATE POLICY "Public can create and join customer session" ON public.customer_sessions FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Customers can read sessions for their active table" ON public.customer_sessions;
  CREATE POLICY "Customers can read sessions for their active table" ON public.customer_sessions FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Staff can view and manage customer sessions" ON public.customer_sessions;
  CREATE POLICY "Staff can view and manage customer sessions" ON public.customer_sessions FOR ALL TO authenticated USING (true);

  -- Menu Add-ons
  DROP POLICY IF EXISTS "Public can view available menu addons" ON public.menu_item_addons;
  CREATE POLICY "Public can view available menu addons" ON public.menu_item_addons FOR SELECT USING (is_available = true);

  DROP POLICY IF EXISTS "Staff have full access to menu addons" ON public.menu_item_addons;
  CREATE POLICY "Staff have full access to menu addons" ON public.menu_item_addons FOR ALL TO authenticated USING (true);

  -- Order Add-ons
  DROP POLICY IF EXISTS "Public can insert order item addons" ON public.order_item_addons;
  CREATE POLICY "Public can insert order item addons" ON public.order_item_addons FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Order item addons can be viewed" ON public.order_item_addons;
  CREATE POLICY "Order item addons can be viewed" ON public.order_item_addons FOR SELECT USING (true);

  -- Table Bills & Items
  DROP POLICY IF EXISTS "Staff can view and manage bills" ON public.table_bills;
  CREATE POLICY "Staff can view and manage bills" ON public.table_bills FOR ALL TO authenticated USING (true);

  DROP POLICY IF EXISTS "Staff can view and manage bill items" ON public.bill_items;
  CREATE POLICY "Staff can view and manage bill items" ON public.bill_items FOR ALL TO authenticated USING (true);

  -- Payments & Notifications
  DROP POLICY IF EXISTS "Staff can view and record payments" ON public.payments;
  CREATE POLICY "Staff can view and record payments" ON public.payments FOR ALL TO authenticated USING (true);

  DROP POLICY IF EXISTS "Staff can view their notifications" ON public.notifications;
  CREATE POLICY "Staff can view their notifications" ON public.notifications FOR ALL TO authenticated USING (true);
END $$;


-- ------------------------------------------------------------------------------
-- PART 3: DEMO SEED DATA ([DEMO DATA]) - 100% VALID HEX UUIDs
-- ------------------------------------------------------------------------------

-- 1. Restaurant Settings
INSERT INTO public.settings (
  id,
  restaurant_name,
  address,
  phone,
  tagline,
  about_text,
  opening_hours,
  maps_url,
  gstin,
  tax_percent,
  bill_footer
)
VALUES (
  1,
  'Manasu restaurant',
  '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
  '+91 98450 12345',
  '[DEMO DATA] South Indian Biryani',
  '[DEMO DATA] Authentic South Indian dum biryanis, fiery starters, and traditional meals prepared fresh in Bengaluru.',
  'Monday - Sunday: 11:30 AM - 11:00 PM',
  'https://maps.google.com/?q=Bengaluru',
  '29AABCM8291Q1ZP',
  5.0,
  'Thank you for dining at Manasu! Visit again.'
)
ON CONFLICT (id) DO UPDATE SET
  restaurant_name = EXCLUDED.restaurant_name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  tagline = EXCLUDED.tagline,
  about_text = EXCLUDED.about_text,
  opening_hours = EXCLUDED.opening_hours,
  maps_url = EXCLUDED.maps_url,
  gstin = EXCLUDED.gstin,
  tax_percent = EXCLUDED.tax_percent,
  bill_footer = EXCLUDED.bill_footer;

-- 2. 8 Categories
INSERT INTO public.categories (id, name, sort_order)
VALUES
  ('c0000000-0000-0000-0000-000000000001', '[DEMO DATA] Chicken Biryani', 1),
  ('c0000000-0000-0000-0000-000000000002', '[DEMO DATA] Mutton Biryani', 2),
  ('c0000000-0000-0000-0000-000000000003', '[DEMO DATA] Veg Biryani', 3),
  ('c0000000-0000-0000-0000-000000000004', '[DEMO DATA] Starters', 4),
  ('c0000000-0000-0000-0000-000000000005', '[DEMO DATA] Kebabs', 5),
  ('c0000000-0000-0000-0000-000000000006', '[DEMO DATA] South Indian Meals', 6),
  ('c0000000-0000-0000-0000-000000000007', '[DEMO DATA] Beverages', 7),
  ('c0000000-0000-0000-0000-000000000008', '[DEMO DATA] Desserts', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

-- 3. 12 Menu Items (All prices in integer paise)
INSERT INTO public.menu_items (id, category_id, name, description, price, is_veg, is_available, sort_order)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'Chicken Dum Biryani',
    '[DEMO DATA] Fragrant long-grain basmati rice layered with spiced marinated bone-in chicken, cooked on slow dum with saffron and herbs.',
    22000,
    false,
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'Boneless Chicken Biryani',
    '[DEMO DATA] Tender boneless chicken pieces steeped in rich masala and slow-dum cooked with seasoned basmati rice.',
    26000,
    false,
    true,
    2
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000002',
    'Mutton Dum Biryani',
    '[DEMO DATA] Tender pasture-fed local mutton marinated overnight in crushed spices, slow dum cooked to perfection with basmati rice.',
    32000,
    false,
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000003',
    'Paneer Biryani',
    '[DEMO DATA] Char-grilled spiced malai paneer cubes layered with aromatic basmati rice, caramelized onions, and fresh mint.',
    19000,
    true,
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000003',
    'Veg Biryani',
    '[DEMO DATA] Assorted garden fresh vegetables and golden potatoes gently spiced and steamed with fragrant long-grain rice.',
    16000,
    true,
    true,
    2
  ),
  (
    'a0000000-0000-0000-0000-000000000006',
    'c0000000-0000-0000-0000-000000000004',
    'Chicken 65',
    '[DEMO DATA] Classic South Indian crispy boneless chicken bites tossed with fresh curry leaves, crushed pepper, and red chillies.',
    18000,
    false,
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000007',
    'c0000000-0000-0000-0000-000000000004',
    'Chicken Lollipop',
    '[DEMO DATA] Spiced batter-coated frenched chicken winglets fried crisp and served with zesty hot garlic sauce (5 pcs).',
    20000,
    false,
    true,
    2
  ),
  (
    'a0000000-0000-0000-0000-000000000008',
    'c0000000-0000-0000-0000-000000000006',
    'Andhra Chicken Curry',
    '[DEMO DATA] Authentic Rayalaseema-style spicy chicken curry simmered in poppy seeds, roasted coconut, and fresh green chillies.',
    24000,
    false,
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000009',
    'c0000000-0000-0000-0000-000000000006',
    'Butter Naan',
    '[DEMO DATA] Soft, cloud-like leavened bread baked fresh in the clay tandoor and brushed generously with desi butter.',
    4000,
    true,
    true,
    2
  ),
  (
    'a0000000-0000-0000-0000-000000000010',
    'c0000000-0000-0000-0000-000000000008',
    'Gulab Jamun',
    '[DEMO DATA] Melt-in-the-mouth golden fried milk dumplings steeped in warm rose and cardamom syrup (2 pcs).',
    6000,
    true,
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000011',
    'c0000000-0000-0000-0000-000000000007',
    'Coke',
    '[DEMO DATA] Chilled 300ml Coca-Cola glass bottle served with ice.',
    4000,
    true,
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000012',
    'c0000000-0000-0000-0000-000000000007',
    'Buttermilk',
    '[DEMO DATA] Cool freshly churned spiced curd tempered with ginger, mustard seeds, curry leaves, and fresh coriander.',
    3000,
    true,
    true,
    2
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  is_veg = EXCLUDED.is_veg,
  is_available = EXCLUDED.is_available,
  sort_order = EXCLUDED.sort_order;

-- 4. 10 Dining Tables (T01–T10)
INSERT INTO public.dining_tables (id, label, qr_token, is_enabled)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'T01', 'qr_demo_t01', true),
  ('e0000000-0000-0000-0000-000000000002', 'T02', 'qr_demo_t02', true),
  ('e0000000-0000-0000-0000-000000000003', 'T03', 'qr_demo_t03', true),
  ('e0000000-0000-0000-0000-000000000004', 'T04', 'qr_demo_t04', true),
  ('e0000000-0000-0000-0000-000000000005', 'T05', 'qr_demo_t05', true),
  ('e0000000-0000-0000-0000-000000000006', 'T06', 'qr_demo_t06', true),
  ('e0000000-0000-0000-0000-000000000007', 'T07', 'qr_demo_t07', true),
  ('e0000000-0000-0000-0000-000000000008', 'T08', 'qr_demo_t08', true),
  ('e0000000-0000-0000-0000-000000000009', 'T09', 'qr_demo_t09', true),
  ('e0000000-0000-0000-0000-000000000010', 'T10', 'qr_demo_t10', true)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  qr_token = EXCLUDED.qr_token,
  is_enabled = EXCLUDED.is_enabled;

-- 5. Multi-Customer Group Orders (Table T03)
INSERT INTO public.table_sessions (id, table_id, status, access_code, opened_at)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000003',
  'open',
  '3184',
  now() - interval '20 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Rahul, Arjun, Priya devices
INSERT INTO public.table_session_devices (id, session_id, device_id, device_name, is_active)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'dev_rahul_token_101', 'Rahul', true),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'dev_arjun_token_102', 'Arjun', true),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'dev_priya_token_103', 'Priya', true)
ON CONFLICT (id) DO NOTHING;

-- Order 1: Rahul (placed)
INSERT INTO public.orders (id, session_id, order_number, status, source, notes, created_at)
VALUES (
  'f0000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000003',
  101,
  'placed',
  'customer',
  '[DEMO DATA] Rahul: Please serve biryani piping hot',
  now() - interval '12 minutes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_lines (id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity, note)
VALUES
  ('00000000-0000-0000-0000-000000001011', 'f0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'Chicken Dum Biryani', 22000, 1, 'Rahul'),
  ('00000000-0000-0000-0000-000000001012', 'f0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000011', 'Coke', 4000, 1, 'Rahul')
ON CONFLICT (id) DO NOTHING;

-- Order 2: Arjun (preparing)
INSERT INTO public.orders (id, session_id, order_number, status, source, notes, created_at)
VALUES (
  'f0000000-0000-0000-0000-000000000102',
  'b0000000-0000-0000-0000-000000000003',
  102,
  'preparing',
  'customer',
  '[DEMO DATA] Arjun: Extra raita with biryani',
  now() - interval '8 minutes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_lines (id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity, note)
VALUES
  ('00000000-0000-0000-0000-000000001021', 'f0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000004', 'Paneer Biryani', 19000, 1, 'Arjun')
ON CONFLICT (id) DO NOTHING;

-- Order 3: Priya (ready)
INSERT INTO public.orders (id, session_id, order_number, status, source, notes, created_at)
VALUES (
  'f0000000-0000-0000-0000-000000000103',
  'b0000000-0000-0000-0000-000000000003',
  103,
  'ready',
  'customer',
  '[DEMO DATA] Priya: Quick starter',
  now() - interval '15 minutes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_lines (id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity, note)
VALUES
  ('00000000-0000-0000-0000-000000001031', 'f0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000006', 'Chicken 65', 18000, 1, 'Priya'),
  ('00000000-0000-0000-0000-000000001032', 'f0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000012', 'Buttermilk', 3000, 1, 'Priya')
ON CONFLICT (id) DO NOTHING;

-- 6. Waiter Order Workflow (Table T07)
INSERT INTO public.table_sessions (id, table_id, status, access_code, opened_at)
VALUES (
  'b0000000-0000-0000-0000-000000000007',
  'e0000000-0000-0000-0000-000000000007',
  'open',
  '7461',
  now() - interval '30 minutes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.orders (id, session_id, order_number, status, source, notes, created_at)
VALUES (
  'f0000000-0000-0000-0000-000000000104',
  'b0000000-0000-0000-0000-000000000007',
  104,
  'served',
  'waiter',
  '[DEMO DATA] Floor Captain Ramesh: Dine-in order',
  now() - interval '25 minutes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_lines (id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity, note)
VALUES
  ('00000000-0000-0000-0000-000000001041', 'f0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000003', 'Mutton Dum Biryani', 32000, 1, 'Captain: Ramesh'),
  ('00000000-0000-0000-0000-000000001042', 'f0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000008', 'Andhra Chicken Curry', 24000, 1, 'Captain: Ramesh'),
  ('00000000-0000-0000-0000-000000001043', 'f0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000009', 'Butter Naan', 4000, 2, 'Captain: Ramesh')
ON CONFLICT (id) DO NOTHING;
