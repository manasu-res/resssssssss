-- ============================================================================
-- MANASU RESTAURANT, BENGALURU
-- Complete Supabase Schema with RLS, Role Verification, and Bangalore Menu
-- ============================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE staff_role AS ENUM ('owner', 'waiter', 'kitchen');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE table_status AS ENUM ('vacant', 'occupied', 'billed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'approved', 'preparing', 'ready', 'served', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_source AS ENUM ('customer', 'waiter');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dietary_type AS ENUM ('veg', 'non_veg');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Staff Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role staff_role NOT NULL DEFAULT 'waiter',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Restaurant Tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT NOT NULL UNIQUE,
    seat_capacity INT NOT NULL DEFAULT 4,
    active_token TEXT NOT NULL UNIQUE,
    status table_status NOT NULL DEFAULT 'vacant',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Menu Categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Menu Items (All money stored in integer paise)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_paise INT NOT NULL CHECK (price_paise > 0),
    dietary dietary_type NOT NULL DEFAULT 'veg',
    is_available BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Combos & Thalis
CREATE TABLE IF NOT EXISTS public.combos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_paise INT NOT NULL CHECK (price_paise > 0),
    dietary dietary_type NOT NULL DEFAULT 'veg',
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.combo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

-- 7. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number SERIAL,
    table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    status order_status NOT NULL DEFAULT 'pending',
    source order_source NOT NULL DEFAULT 'customer',
    waiter_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    notes TEXT DEFAULT '',
    total_paise INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Order Items (Holds snapshot of item name and price in paise at order placement)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    combo_id UUID REFERENCES public.combos(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    price_paise INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    dietary dietary_type NOT NULL DEFAULT 'veg',
    status order_status NOT NULL DEFAULT 'pending',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Bills
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number SERIAL,
    table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
    subtotal_paise INT NOT NULL,
    tax_paise INT NOT NULL DEFAULT 0,
    discount_paise INT NOT NULL DEFAULT 0,
    final_paise INT NOT NULL,
    payment_method payment_method NOT NULL,
    settled_by UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Bill Orders (Association)
CREATE TABLE IF NOT EXISTS public.bill_orders (
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    PRIMARY KEY (bill_id, order_id)
);

-- ============================================================================
-- HELPER FUNCTIONS FOR ROLE CHECKING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS staff_role AS $$
    SELECT role FROM public.staff_profiles
    WHERE id = auth.uid() AND active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid() AND active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid() AND role = 'owner' AND active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_orders ENABLE ROW LEVEL SECURITY;

-- Staff Profiles Policies
CREATE POLICY "Staff can view their own profile or owner can view all"
    ON public.staff_profiles FOR SELECT
    USING (auth.uid() = id OR public.is_owner());

CREATE POLICY "Only owner can insert or update staff"
    ON public.staff_profiles FOR ALL
    USING (public.is_owner());

-- Restaurant Tables Policies
CREATE POLICY "Staff can view all tables"
    ON public.restaurant_tables FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Staff can update tables"
    ON public.restaurant_tables FOR UPDATE
    USING (public.is_staff());

CREATE POLICY "Owner can insert or delete tables"
    ON public.restaurant_tables FOR ALL
    USING (public.is_owner());

-- Menu Categories Policies
CREATE POLICY "Public can view active menu categories"
    ON public.menu_categories FOR SELECT
    USING (is_active = true OR public.is_staff());

CREATE POLICY "Owner can manage menu categories"
    ON public.menu_categories FOR ALL
    USING (public.is_owner());

-- Menu Items Policies
CREATE POLICY "Public can view available menu items"
    ON public.menu_items FOR SELECT
    USING (is_available = true OR public.is_staff());

CREATE POLICY "Owner can manage menu items"
    ON public.menu_items FOR ALL
    USING (public.is_owner());

-- Combos Policies
CREATE POLICY "Public can view combos"
    ON public.combos FOR SELECT
    USING (is_available = true OR public.is_staff());

CREATE POLICY "Owner can manage combos"
    ON public.combos FOR ALL
    USING (public.is_owner());

-- Orders & Order Items Policies
-- Note: Customers only interact with orders via Server Route Handlers using Service Role.
-- Direct client access is restricted strictly to authenticated staff.
CREATE POLICY "Staff can view orders"
    ON public.orders FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Staff can insert and update orders"
    ON public.orders FOR ALL
    USING (public.is_staff());

CREATE POLICY "Staff can view order items"
    ON public.order_items FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Staff can manage order items"
    ON public.order_items FOR ALL
    USING (public.is_staff());

-- Bills Policies
CREATE POLICY "Staff can view bills"
    ON public.bills FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Staff can insert bills"
    ON public.bills FOR INSERT
    WITH CHECK (public.is_staff());

CREATE POLICY "Staff can view bill orders"
    ON public.bill_orders FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Staff can insert bill orders"
    ON public.bill_orders FOR INSERT
    WITH CHECK (public.is_staff());

-- ============================================================================
-- REALTIME REPLICATION SETUP
-- ============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SEED DATA: BENGALURU AUTHENTIC MENU & TABLES
-- ============================================================================

-- Tables
INSERT INTO public.restaurant_tables (table_number, seat_capacity, active_token, status)
VALUES
    ('Table 1', 2, 'tbl-manasu-01', 'vacant'),
    ('Table 2', 4, 'tbl-manasu-02', 'vacant'),
    ('Table 3', 4, 'tbl-manasu-03', 'vacant'),
    ('Table 4', 6, 'tbl-manasu-04', 'vacant'),
    ('Table 5', 4, 'tbl-manasu-05', 'vacant'),
    ('Table 6', 8, 'tbl-manasu-06', 'vacant')
ON CONFLICT (table_number) DO NOTHING;

-- Categories
INSERT INTO public.menu_categories (id, name, sort_order)
VALUES
    ('11111111-1111-1111-1111-111111111101', 'Tiffins & Breakfast', 1),
    ('11111111-1111-1111-1111-111111111102', 'Bengaluru Starters & Roasts', 2),
    ('11111111-1111-1111-1111-111111111103', 'Biryani & Traditional Meals', 3),
    ('11111111-1111-1111-1111-111111111104', 'Curries & Breads', 4),
    ('11111111-1111-1111-1111-111111111105', 'Beverages & Sweets', 5)
ON CONFLICT (id) DO NOTHING;

-- Menu Items (All stored in integer paise: ₹90 = 9000, ₹280 = 28000)
INSERT INTO public.menu_items (category_id, name, description, price_paise, dietary, sort_order)
VALUES
    -- Tiffins & Breakfast
    ('11111111-1111-1111-1111-111111111101', 'Davangere Benne Dosa', 'Crisp butter dosa served with spicy potato palya and fresh coconut chutney', 9500, 'veg', 1),
    ('11111111-1111-1111-1111-111111111101', 'Thatte Idli with Crispy Vada', 'Steamed plate idli steeped in ghee podi with a crunchy medu vada', 8000, 'veg', 2),
    ('11111111-1111-1111-1111-111111111101', 'Bisi Bele Bath', 'Slow-cooked spiced rice, lentils, and country vegetables tempered with pure ghee', 8500, 'veg', 3),
    ('11111111-1111-1111-1111-111111111101', 'Chow Chow Bath', 'Classic Bengaluru duo: spicy khara bath paired with sweet pineapple kesari bath', 9000, 'veg', 4),
    ('11111111-1111-1111-1111-111111111101', 'Mangalore Buns (2 pcs)', 'Sweet, fluffy banana puris served with hot coconut chutney and sambar', 7000, 'veg', 5),

    -- Starters & Roasts
    ('11111111-1111-1111-1111-111111111102', 'Kundapura Chicken Ghee Roast', 'Tender chicken tossed in fiery Byadgi chilli paste and slow-roasted in desi ghee', 26000, 'non_veg', 1),
    ('11111111-1111-1111-1111-111111111102', 'Mutton Pepper Sukka', 'Slow-cooked local mutton with black pepper, curry leaves, and toasted coconut', 32000, 'non_veg', 2),
    ('11111111-1111-1111-1111-111111111102', 'Crispy Babycorn Pepper Fry', 'Fresh babycorn flash-fried with crushed black pepper and fresh green chillies', 17000, 'veg', 3),
    ('11111111-1111-1111-1111-111111111102', 'Mushroom Ghee Roast', 'Button mushrooms sauteed in rich Mangalorean red masala and ghee', 21000, 'veg', 4),

    -- Biryani & Traditional Meals
    ('11111111-1111-1111-1111-111111111103', 'Shivaji Military Donne Biryani (Chicken)', 'Short-grain Seeraga Samba rice infused with mint, coriander, and country chicken', 24000, 'non_veg', 1),
    ('11111111-1111-1111-1111-111111111103', 'Mutton Donne Biryani', 'Aromatic Donne Biryani layered with succulent tender mutton pieces', 31000, 'non_veg', 2),
    ('11111111-1111-1111-1111-111111111103', 'North Karnataka Jowar Roti Oota', 'Two hot jolada rotis with yennegai (brinjal curry), jhunka, and shenga chutney podi', 18000, 'veg', 3),
    ('11111111-1111-1111-1111-111111111103', 'Manasu Special Veg Meals', 'Rice, rasam, Majjige Huli, veg palya, curd, papad, and seasonal payasa', 16000, 'veg', 4),
    ('11111111-1111-1111-1111-111111111103', 'Tempered Curd Rice', 'Cooling curd rice tempered with mustard, curry leaves, ginger, and pomegranate', 8500, 'veg', 5),

    -- Curries & Breads
    ('11111111-1111-1111-1111-111111111104', 'Kori Rotti with Coastal Chicken Curry', 'Crispy dry rice wafers served with hot, fragrant coconut chicken gravy', 24000, 'non_veg', 1),
    ('11111111-1111-1111-1111-111111111104', 'Neer Dosa (3 pcs)', 'Paper-thin delicate rice crepes served with coconut chutney and jaggery milk', 9000, 'veg', 2),
    ('11111111-1111-1111-1111-111111111104', 'Malabar Parotta (2 pcs)', 'Flaky, layered handmade parotta', 6000, 'veg', 3),
    ('11111111-1111-1111-1111-111111111104', 'Paneer Kundapura Curry', 'Paneer cubes simmered in stone-ground coconut and roasted spice gravy', 21000, 'veg', 4),

    -- Beverages & Sweets
    ('11111111-1111-1111-1111-111111111105', 'Degree Filter Coffee', 'Strong Chicory-blended decoction frothed with fresh whole milk in brass davara', 3500, 'veg', 1),
    ('11111111-1111-1111-1111-111111111105', 'Masala Majjige (Buttermilk)', 'Chilled spiced churned buttermilk with ginger, green chilli, and fresh cilantro', 3000, 'veg', 2),
    ('11111111-1111-1111-1111-111111111105', 'Elaneer Payasam', 'Tender coconut pulp simmered in reduced cardamom milk and jaggery', 9000, 'veg', 3),
    ('11111111-1111-1111-1111-111111111105', 'Melt-in-mouth Mysore Pak (2 pcs)', 'Traditional gram flour fudge infused with boiling pure ghee', 6000, 'veg', 4);
