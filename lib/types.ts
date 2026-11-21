export type DietaryType = 'veg' | 'non_veg';
export type TableStatus = 'vacant' | 'occupied' | 'billed';
export type OrderStatus = 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'pending' | 'approved';
export type OrderSource = 'customer' | 'waiter';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'razorpay';
export type StaffRole = 'owner' | 'manager' | 'waiter' | 'kitchen';

export interface RestaurantSettings {
  id: number;
  restaurant_name: string;
  address: string;
  phone: string;
  tagline?: string;
  about_text?: string;
  opening_hours?: string;
  maps_url?: string;
  photos?: string[];
  large_order_threshold_paise?: number;
  gstin?: string | null;
  tax_percent: number;
  service_charge_percent?: number;
  bill_footer: string;
  paper_width?: '80mm' | '58mm';
}

export interface MenuItemAddon {
  id: string;
  menu_item_id?: string;
  name: string;
  price_paise: number;
  is_available: boolean;
  sort_order: number;
}

export interface CustomerSession {
  id: string;
  table_session_id: string;
  customer_name: string;
  device_token: string;
  is_active: boolean;
  joined_at: string;
  last_seen_at?: string;
}

export interface TableSessionDevice {
  id: string;
  session_id: string;
  device_id: string;
  device_name?: string;
  joined_at: string;
  removed_at?: string | null;
  is_active: boolean;
}

export interface StaffProfile {
  id: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  table_number: string;
  seat_capacity: number;
  active_token: string;
  status: TableStatus;
  is_active: boolean;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price_paise: number;
  dietary: DietaryType;
  is_available: boolean;
  sort_order: number;
  image_url?: string | null;
  addons?: MenuItemAddon[];
}

export interface ComboItemEntry {
  id: string;
  name: string;
  quantity: number;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  price_paise: number;
  dietary: DietaryType;
  is_available: boolean;
  items?: ComboItemEntry[];
}

export interface OrderItemAddon {
  id: string;
  order_item_id: string;
  addon_id?: string | null;
  addon_name_snapshot: string;
  addon_price_paise_snapshot: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id?: string | null;
  combo_id?: string | null;
  item_name: string;
  price_paise: number;
  quantity: number;
  dietary: DietaryType;
  status: OrderStatus;
  notes?: string;
  addons?: OrderItemAddon[];
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  table_id: string;
  table_session_id?: string;
  customer_session_id?: string | null;
  customer_name?: string | null;
  status: OrderStatus;
  source: OrderSource;
  waiter_id?: string | null;
  waiter_name?: string | null;
  notes?: string;
  total_paise: number;
  created_at: string;
  updated_at: string;
  table?: RestaurantTable;
  items?: OrderItem[];
  needs_confirmation?: boolean;
  idempotency_key?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
}

export interface Bill {
  id: string;
  bill_number: number | string;
  bill_no?: string;
  session_id?: string;
  table_id?: string;
  subtotal_paise: number;
  subtotal?: number;
  tax_paise: number;
  tax_amount?: number;
  discount_paise?: number;
  final_paise: number;
  total?: number;
  payment_method: PaymentMethod;
  settled_by?: string | null;
  created_by?: string | null;
  created_at: string;
  paid_at?: string;
  table?: RestaurantTable | { table_number: string; label?: string };
  items?: Array<{
    id?: string;
    item_name?: string;
    name?: string;
    name_snapshot?: string;
    price_paise?: number;
    price_snapshot?: number;
    quantity: number;
    notes?: string;
    note?: string;
    [key: string]: any;
  }>;
  is_cancelled?: boolean;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
}
