-- ==============================================================================
-- MANASU RESTAURANT, BENGALURU
-- Seed Data: Sample Categories, Menu Items, Combos, Tables, and Settings
--
-- All sample records are clearly labeled with 'SAMPLE' so you can easily
-- inspect, test, or delete them later.
--
-- TO DELETE ALL SAMPLE DATA LATER, RUN:
--   DELETE FROM public.dining_tables WHERE label LIKE 'SAMPLE%';
--   DELETE FROM public.combos WHERE name LIKE 'SAMPLE%';
--   DELETE FROM public.menu_items WHERE name LIKE 'SAMPLE%';
--   DELETE FROM public.categories WHERE name LIKE 'SAMPLE%';
-- ==============================================================================

-- 1. Initial Settings (Singleton Row id = 1)
INSERT INTO public.settings (id, restaurant_name, address, phone, gstin, tax_percent, bill_footer)
VALUES (
  1,
  'Manasu Restaurant',
  '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
  '+91 80 2520 1980',
  '29AABCM8291Q1ZP',
  5.0,
  'Thank you for dining at Manasu! Visit again.'
)
ON CONFLICT (id) DO UPDATE SET
  restaurant_name = EXCLUDED.restaurant_name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  gstin = EXCLUDED.gstin,
  tax_percent = EXCLUDED.tax_percent,
  bill_footer = EXCLUDED.bill_footer;

-- 2. Sample Categories (3 Categories)
INSERT INTO public.categories (id, name, sort_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'SAMPLE - Tiffins & Breakfast', 1),
  ('c1000000-0000-0000-0000-000000000002', 'SAMPLE - Bengaluru Starters & Roasts', 2),
  ('c1000000-0000-0000-0000-000000000003', 'SAMPLE - Biryani & Traditional Meals', 3)
ON CONFLICT (id) DO NOTHING;

-- 3. Sample Menu Items (12 Items, prices in integer paise)
-- Note: 9500 paise = ₹95, 26000 paise = ₹260, 3500 paise = ₹35
INSERT INTO public.menu_items (id, category_id, name, description, price, is_veg, is_available, sort_order)
VALUES
  -- Category 1: Tiffins & Breakfast
  (
    'm1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'SAMPLE - Davangere Benne Dosa',
    'Crisp butter dosa served with spicy potato palya and fresh coconut chutney',
    9500,
    true,
    true,
    1
  ),
  (
    'm1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'SAMPLE - Thatte Idli with Crispy Vada',
    'Steamed plate idli steeped in ghee podi with a crunchy medu vada',
    8000,
    true,
    true,
    2
  ),
  (
    'm1000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000001',
    'SAMPLE - Bisi Bele Bath',
    'Slow-cooked spiced rice, lentils, and country vegetables tempered with pure ghee',
    8500,
    true,
    true,
    3
  ),
  (
    'm1000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000001',
    'SAMPLE - Chow Chow Bath',
    'Classic Bengaluru duo: spicy khara bath paired with sweet pineapple kesari bath',
    9000,
    true,
    true,
    4
  ),
  (
    'm1000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000001',
    'SAMPLE - Degree Filter Coffee',
    'Strong chicory-blended decoction frothed with whole milk in a brass davara',
    3500,
    true,
    true,
    5
  ),

  -- Category 2: Starters & Roasts
  (
    'm1000000-0000-0000-0000-000000000006',
    'c1000000-0000-0000-0000-000000000002',
    'SAMPLE - Kundapura Chicken Ghee Roast',
    'Tender chicken tossed in Byadgi chilli paste and slow-roasted in desi ghee',
    26000,
    false,
    true,
    1
  ),
  (
    'm1000000-0000-0000-0000-000000000007',
    'c1000000-0000-0000-0000-000000000002',
    'SAMPLE - Mutton Pepper Sukka',
    'Slow-cooked local mutton with black pepper, curry leaves, and toasted coconut',
    32000,
    false,
    true,
    2
  ),
  (
    'm1000000-0000-0000-0000-000000000008',
    'c1000000-0000-0000-0000-000000000002',
    'SAMPLE - Crispy Babycorn Pepper Fry',
    'Fresh babycorn flash-fried with crushed black pepper and green chillies',
    17000,
    true,
    true,
    3
  ),
  (
    'm1000000-0000-0000-0000-000000000009',
    'c1000000-0000-0000-0000-000000000002',
    'SAMPLE - Mushroom Ghee Roast',
    'Button mushrooms sauteed in rich Mangalorean red masala and pure ghee',
    21000,
    true,
    true,
    4
  ),

  -- Category 3: Biryani & Traditional Meals
  (
    'm1000000-0000-0000-0000-000000000010',
    'c1000000-0000-0000-0000-000000000003',
    'SAMPLE - Shivaji Military Donne Biryani',
    'Seeraga Samba rice infused with mint, coriander, and country chicken',
    24000,
    false,
    true,
    1
  ),
  (
    'm1000000-0000-0000-0000-000000000011',
    'c1000000-0000-0000-0000-000000000003',
    'SAMPLE - Mutton Donne Biryani',
    'Aromatic Donne Biryani layered with succulent tender mutton pieces',
    31000,
    false,
    true,
    2
  ),
  (
    'm1000000-0000-0000-0000-000000000012',
    'c1000000-0000-0000-0000-000000000003',
    'SAMPLE - North Karnataka Jowar Roti Oota',
    'Two hot jolada rotis with yennegai brinjal curry, jhunka, and shenga podi',
    18000,
    true,
    true,
    3
  )
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Combos (2 Combos)
INSERT INTO public.combos (id, name, description, price, is_veg, is_available, sort_order)
VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'SAMPLE - South Bengaluru Breakfast Combo',
    '1 Thatte Idli with Crispy Vada paired with hot authentic Degree Filter Coffee',
    11000,
    true,
    true,
    1
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'SAMPLE - Military Donne Biryani Feast',
    '1 Chicken Donne Biryani paired with Kundapura Chicken Ghee Roast',
    38000,
    false,
    true,
    2
  )
ON CONFLICT (id) DO NOTHING;

-- Combo Items Association
INSERT INTO public.combo_items (combo_id, menu_item_id, quantity)
VALUES
  -- Breakfast combo items
  ('b1000000-0000-0000-0000-000000000001', 'm1000000-0000-0000-0000-000000000002', 1),
  ('b1000000-0000-0000-0000-000000000001', 'm1000000-0000-0000-0000-000000000005', 1),
  -- Biryani feast items
  ('b1000000-0000-0000-0000-000000000002', 'm1000000-0000-0000-0000-000000000010', 1),
  ('b1000000-0000-0000-0000-000000000002', 'm1000000-0000-0000-0000-000000000006', 1)
ON CONFLICT (combo_id, menu_item_id) DO NOTHING;

-- 5. Sample Dining Tables (6 Tables with long random unguessable tokens)
INSERT INTO public.dining_tables (id, label, qr_token, is_enabled)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'SAMPLE 1', 'mnsu_tbl_a8f9c2d1e0b4715698034afecdb912', true),
  ('d1000000-0000-0000-0000-000000000002', 'SAMPLE 2', 'mnsu_tbl_b7e3f4a1c9d8205461937baefdc823', true),
  ('d1000000-0000-0000-0000-000000000003', 'SAMPLE 3', 'mnsu_tbl_c5d2e8b9f0a7316582046cbfaed734', true),
  ('d1000000-0000-0000-0000-000000000004', 'SAMPLE 4', 'mnsu_tbl_d3a1f7c8b9e6427693157dcbafe645', true),
  ('d1000000-0000-0000-0000-000000000005', 'SAMPLE 5', 'mnsu_tbl_e1b9c6d7a8f5538704268edcbaf556', true),
  ('d1000000-0000-0000-0000-000000000006', 'SAMPLE 6', 'mnsu_tbl_f9c8d5e6b7a4649815379fedcba467', true)
ON CONFLICT (label) DO UPDATE SET
  qr_token = EXCLUDED.qr_token,
  is_enabled = EXCLUDED.is_enabled;
