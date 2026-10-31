export type DietaryType = 'veg' | 'non_veg';
export type TableStatus = 'vacant' | 'occupied' | 'billed';
export type OrderStatus = 'pending' | 'approved' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderSource = 'customer' | 'waiter';
export type PaymentMethod = 'cash' | 'upi' | 'card';
export type StaffRole = 'owner' | 'waiter' | 'kitchen';

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
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  table_id: string;
  status: OrderStatus;
  source: OrderSource;
  waiter_id?: string | null;
  notes?: string;
  total_paise: number;
  created_at: string;
  updated_at: string;
  table?: RestaurantTable;
  items?: OrderItem[];
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
