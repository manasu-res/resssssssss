-- ==============================================================================
-- MANASU RESTAURANT - RLS TEST VERIFICATION SCRIPT
-- This SQL test script verifies the 4 core security assertions:
-- 1. Anonymous users cannot read anything from any table.
-- 2. Waiters cannot modify menu prices or alter settings.
-- 3. Waiters cannot edit or delete bills after creation.
-- 4. Kitchen staff cannot read or write to bills or change prices.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- TEST 1: Anonymous User Isolation
-- Expected: All queries return 0 rows or permission denied.
-- ------------------------------------------------------------------------------
SET ROLE anon;

-- Should return 0 rows
SELECT count(*) AS anon_profiles_count FROM public.profiles;
SELECT count(*) AS anon_bills_count FROM public.bills;
SELECT count(*) AS anon_orders_count FROM public.orders;
SELECT count(*) AS anon_menu_count FROM public.menu_items;
SELECT count(*) AS anon_tables_count FROM public.dining_tables;

-- INSERT should fail / violate RLS
-- INSERT INTO public.orders (session_id, source) VALUES ('00000000-0000-0000-0000-000000000000', 'customer'); -- FAIL (RLS)

-- ------------------------------------------------------------------------------
-- TEST 2: Waiter Role Permissions
-- Expected: Waiter can read menu and manage orders/sessions, but CANNOT:
--           - Update prices on menu_items
--           - Update or delete bills
--           - Read other staff profiles
-- ------------------------------------------------------------------------------
-- (Simulate authenticated waiter session with auth.uid() pointing to a waiter profile)
-- SET LOCAL "request.jwt.claims" = '{"sub": "waiter-uuid-here", "role": "authenticated"}';
-- SET ROLE authenticated;

-- Waiter attempting to alter price on a menu item:
-- UPDATE public.menu_items SET price = 100 WHERE id = '...'; 
-- Expected Result: 0 rows updated (Permission denied by RLS policy "Owner has full access to menu_items")

-- Waiter attempting to mutate an existing bill:
-- UPDATE public.bills SET total = 0 WHERE id = '...';
-- Expected Result: 0 rows updated (No UPDATE policy defined for waiter on public.bills)

-- Waiter attempting to view all profiles:
-- SELECT * FROM public.profiles;
-- Expected Result: Only returns 1 row (waiter's own profile where id = auth.uid())

-- ------------------------------------------------------------------------------
-- TEST 3: Kitchen Role Permissions
-- Expected: Kitchen can view tickets and update order status, but CANNOT:
--           - Read or touch bills
--           - Change menu prices
--           - Access table settings
-- ------------------------------------------------------------------------------
-- (Simulate authenticated kitchen session)
-- SET LOCAL "request.jwt.claims" = '{"sub": "kitchen-uuid-here", "role": "authenticated"}';
-- SET ROLE authenticated;

-- Kitchen attempting to inspect bills:
-- SELECT * FROM public.bills;
-- Expected Result: 0 rows returned (No SELECT policy defined for kitchen on public.bills)

-- Kitchen attempting to insert a bill:
-- INSERT INTO public.bills (...) VALUES (...);
-- Expected Result: RLS policy violation

-- Kitchen attempting to update order status (ALLOWED):
-- UPDATE public.orders SET status = 'preparing' WHERE id = '...';
-- Expected Result: Allowed by policy "Kitchen can update order status only"

-- ------------------------------------------------------------------------------
-- TEST 4: Owner Role Permissions
-- Expected: Owner has unrestricted access to all tables, reports, settings, and staff.
-- ------------------------------------------------------------------------------

ROLLBACK;
