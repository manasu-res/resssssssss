# Manasu Restaurant, Bengaluru
### Table Ordering, Utilitarian POS & Thermal Billing Web App

A high-speed, mobile-first web app built specifically for **Manasu Restaurant, Bengaluru** (100 Feet Road, Indiranagar). Designed to replace expensive standalone billing hardware with a reliable, instant-response system that runs effortlessly on inexpensive phones, tablets, and POS receipt printers.

---

## 1. Stack & Architecture

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Database / Auth / Realtime**: Supabase (Postgres, Row Level Security, Auth, Realtime)
- **Deployment**: Vercel-ready

### The Four Operational Areas:
1. **/t/[token]** &mdash; **Customer Table Ordering**
   - No login needed. Opened instantly by scanning table QR code.
   - Printed menu card aesthetics (`#F6F1E7` warm paper, `#1F1B16` ink, Fraunces serif headings, DM Sans body).
   - Dense item rows with dotted leader line, price in ₹, Indian Veg / Non-Veg dot symbols.
   - Live order tracking banner ("Sent to waiter", "Cooking in kitchen", "Ready to serve").
2. **/waiter** &mdash; **Floor POS Console**
   - High-density table grid with status indicators (`Vacant`, `Occupied`, `Billed`).
   - 1-tap customer order approval (sends order straight to kitchen).
   - Direct item ordering at table for verbal customer orders.
   - Bill calculation with 5% GST (2.5% CGST + 2.5% SGST), discounts, payment options (Cash / UPI / Card).
   - Thermal receipt format (58mm / 80mm printable layout).
   - Table vacating and QR token refresh for the next guests.
3. **/kitchen** &mdash; **Kitchen Display System (KDS)**
   - Dark theme (`#0F1115`) with high contrast, readable from 2 metres away.
   - Big bold table labels, elapsed timers, order line items with large quantity badges (`2x`), highlighted table cooking instructions.
   - 1-tap large transition buttons (&ge;48px): `[Start Cooking]` &rarr; `[Ready to Serve]` &rarr; `[Served / Clear]`.
4. **/admin** &mdash; **Owner Management & Reports**
   - Plain tables and forms, left sidebar, zero fluff.
   - Daily financial reports: total revenue, order count, payment split (UPI, Cash, Card), bestselling Bengaluru dishes.
   - Menu item management: add, edit, change prices, toggle availability.
   - Table management: generate and print QR stand cards, copy direct customer links, reset tokens.
5. **/login** &mdash; **Staff Sign In**
   - Clean authentication with quick 1-tap role access buttons for development/testing (`Waiter`, `Kitchen`, `Owner`).

---

## 2. Security Rules (Enforced)

1. **Customers Never Talk to Supabase Directly**:
   - Customer pages call Next.js route handlers (`/api/customer/order`, `/api/customer/menu`), which validate table tokens and execute server-side with service-role security.
2. **Server-Side Price Snapshot**:
   - Client prices are strictly ignored. The server reads prices directly from the database and saves an immutable snapshot (`price_paise` and `item_name`) on each order item.
3. **Integer Paise Storage**:
   - All monetary values are strictly stored as integer paise (e.g. ₹95.00 &rarr; `9500` paise) to prevent floating-point rounding errors.
4. **Rate Limiting**:
   - In-memory sliding window rate limits protect customer endpoints per client IP (30 req/min) and per table token (6 orders/2 min) against flooding.
5. **Input Validation**:
   - Every route validates data using `Zod` schemas.

---

## 3. Environment Variables

Create a file named `.env.local` in the project root:

```env
# Supabase Project API Credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Base URL for QR generation
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note**: A standalone in-memory fallback store is built-in. If Supabase credentials are left at default or demo values, the application runs out of the box with seeded Bengaluru dishes, tables, and demo orders.

---

## 4. Supabase Database Setup

When you are ready to connect a live Supabase project:
1. Open your **Supabase Dashboard** &rarr; **SQL Editor**.
2. Copy and run the entire file [`supabase/schema.sql`](file:///c:/Users/SES/OneDrive/Documents/Manasu/supabase/schema.sql).
   - Creates Enums, Tables (`restaurant_tables`, `menu_categories`, `menu_items`, `combos`, `orders`, `order_items`, `bills`, `staff_profiles`).
   - Enables Row Level Security (RLS) policies on every table.
   - Configures Realtime replication on `orders`, `order_items`, `restaurant_tables`.
   - Seeds authentic Bengaluru menu items (Davangere Benne Dosa, Thatte Idli, Donne Biryani, Kundapura Chicken Ghee Roast, Degree Filter Coffee, etc.) and initial tables.

---

## 5. How to Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
