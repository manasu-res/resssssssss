-- ==============================================================================
-- MANASU DIGITAL — PRODUCTION DEMO SEED DATA (SOUTH BIRYANI TEMPORARY CATALOG)
-- File: supabase/demo_seed.sql
-- Note: ALL RECORDS ARE CLEARLY LABELED AS [DEMO DATA].
-- ==============================================================================

-- Ensure missing columns exist in settings table before inserting
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_text TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS opening_hours TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS maps_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS large_order_threshold_paise INT DEFAULT 500000;

-- 1. RESTAURANT SETTINGS (Singleton Row id = 1)
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

-- 2. 8 DEMO MENU CATEGORIES
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

-- 3. 12 SAMPLE MENU ITEMS (All prices in integer paise)
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

-- 4. 10 DEMO DINING TABLES (T01–T10)
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

-- 5. DEMO SESSIONS & MULTI-CUSTOMER GROUP ORDERS (Table T03)
INSERT INTO public.table_sessions (id, table_id, status, access_code, opened_at)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000003',
  'open',
  '3184',
  now() - interval '20 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Customer 1: Rahul on Table T03
INSERT INTO public.table_session_devices (id, session_id, device_id, device_name, is_active)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000003',
  'dev_rahul_token_101',
  'Rahul',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Ensure orders_status_check permits all valid workflow statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'placed', 'accepted', 'approved', 'preparing', 'ready', 'served', 'cancelled'));

-- Order 1 (Rahul - status: placed)
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
  (
    '00000000-0000-0000-0000-000000001011',
    'f0000000-0000-0000-0000-000000000101',
    'a0000000-0000-0000-0000-000000000001',
    'Chicken Dum Biryani',
    22000,
    1,
    'Rahul'
  ),
  (
    '00000000-0000-0000-0000-000000001012',
    'f0000000-0000-0000-0000-000000000101',
    'a0000000-0000-0000-0000-000000000011',
    'Coke',
    4000,
    1,
    'Rahul'
  )
ON CONFLICT (id) DO NOTHING;

-- Customer 2: Arjun on Table T03
INSERT INTO public.table_session_devices (id, session_id, device_id, device_name, is_active)
VALUES (
  'd0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'dev_arjun_token_102',
  'Arjun',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Order 2 (Arjun - status: preparing)
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
  (
    '00000000-0000-0000-0000-000000001021',
    'f0000000-0000-0000-0000-000000000102',
    'a0000000-0000-0000-0000-000000000004',
    'Paneer Biryani',
    19000,
    1,
    'Arjun'
  )
ON CONFLICT (id) DO NOTHING;

-- Customer 3: Priya on Table T03
INSERT INTO public.table_session_devices (id, session_id, device_id, device_name, is_active)
VALUES (
  'd0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000003',
  'dev_priya_token_103',
  'Priya',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Order 3 (Priya - status: ready)
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
  (
    '00000000-0000-0000-0000-000000001031',
    'f0000000-0000-0000-0000-000000000103',
    'a0000000-0000-0000-0000-000000000006',
    'Chicken 65',
    18000,
    1,
    'Priya'
  ),
  (
    '00000000-0000-0000-0000-000000001032',
    'f0000000-0000-0000-0000-000000000103',
    'a0000000-0000-0000-0000-000000000012',
    'Buttermilk',
    3000,
    1,
    'Priya'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. DEMO WAITER ORDER WORKFLOW (Table T07)
INSERT INTO public.table_sessions (id, table_id, status, access_code, opened_at)
VALUES (
  'b0000000-0000-0000-0000-000000000007',
  'e0000000-0000-0000-0000-000000000007',
  'open',
  '7461',
  now() - interval '30 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- Order 4 (Waiter Ramesh - status: served)
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
  (
    '00000000-0000-0000-0000-000000001041',
    'f0000000-0000-0000-0000-000000000104',
    'a0000000-0000-0000-0000-000000000003',
    'Mutton Dum Biryani',
    32000,
    1,
    'Captain: Ramesh'
  ),
  (
    '00000000-0000-0000-0000-000000001042',
    'f0000000-0000-0000-0000-000000000104',
    'a0000000-0000-0000-0000-000000000008',
    'Andhra Chicken Curry',
    24000,
    1,
    'Captain: Ramesh'
  ),
  (
    '00000000-0000-0000-0000-000000001043',
    'f0000000-0000-0000-0000-000000000104',
    'a0000000-0000-0000-0000-000000000009',
    'Butter Naan',
    4000,
    2,
    'Captain: Ramesh'
  )
ON CONFLICT (id) DO NOTHING;
