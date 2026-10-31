export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StaffRole = 'owner' | 'waiter' | 'kitchen';
export type TableSessionStatus = 'open' | 'billed' | 'closed';
export type OrderStatus = 'pending' | 'approved' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderSource = 'customer' | 'waiter';
export type PaymentMethod = 'cash' | 'upi' | 'card';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: StaffRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role: StaffRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: StaffRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string;
          price: number; // integer paise
          is_veg: boolean;
          is_available: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          description?: string;
          price: number;
          is_veg?: boolean;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          description?: string;
          price?: number;
          is_veg?: boolean;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      combos: {
        Row: {
          id: string;
          name: string;
          description: string;
          price: number;
          is_veg: boolean;
          is_available: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          price: number;
          is_veg?: boolean;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          price?: number;
          is_veg?: boolean;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      combo_items: {
        Row: {
          combo_id: string;
          menu_item_id: string;
          quantity: number;
        };
        Insert: {
          combo_id: string;
          menu_item_id: string;
          quantity?: number;
        };
        Update: {
          combo_id?: string;
          menu_item_id?: string;
          quantity?: number;
        };
        Relationships: [];
      };
      dining_tables: {
        Row: {
          id: string;
          label: string;
          qr_token: string;
          is_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          qr_token: string;
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          qr_token?: string;
          is_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      table_sessions: {
        Row: {
          id: string;
          table_id: string;
          status: TableSessionStatus;
          opened_by: string | null;
          opened_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          table_id: string;
          status?: TableSessionStatus;
          opened_by?: string | null;
          opened_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          table_id?: string;
          status?: TableSessionStatus;
          opened_by?: string | null;
          opened_at?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          session_id: string;
          status: OrderStatus;
          source: OrderSource;
          created_at: string;
          approved_by: string | null;
          approved_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          status?: OrderStatus;
          source: OrderSource;
          created_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          status?: OrderStatus;
          source?: OrderSource;
          created_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Relationships: [];
      };
      order_lines: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string | null;
          combo_id: string | null;
          name_snapshot: string;
          price_snapshot: number;
          quantity: number;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id?: string | null;
          combo_id?: string | null;
          name_snapshot: string;
          price_snapshot: number;
          quantity: number;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          menu_item_id?: string | null;
          combo_id?: string | null;
          name_snapshot?: string;
          price_snapshot?: number;
          quantity?: number;
          note?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          id: string;
          session_id: string;
          bill_no: string;
          subtotal: number;
          tax_amount: number;
          total: number;
          payment_method: PaymentMethod;
          paid_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          bill_no?: string;
          subtotal: number;
          tax_amount: number;
          total: number;
          payment_method: PaymentMethod;
          paid_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          bill_no?: string;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          payment_method?: PaymentMethod;
          paid_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          id: number;
          restaurant_name: string;
          address: string;
          phone: string;
          gstin: string | null;
          tax_percent: number;
          bill_footer: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          restaurant_name: string;
          address: string;
          phone: string;
          gstin?: string | null;
          tax_percent?: number;
          bill_footer?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          restaurant_name?: string;
          address?: string;
          phone?: string;
          gstin?: string | null;
          tax_percent?: number;
          bill_footer?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_daily_bill_no: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_waiter: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_kitchen: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      staff_role: StaffRole;
      table_session_status: TableSessionStatus;
      order_status: OrderStatus;
      order_source: OrderSource;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}
