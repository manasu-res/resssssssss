import {
  MenuCategory,
  MenuItem,
  RestaurantTable,
  Combo,
  Order,
  OrderItem,
  Bill,
  StaffProfile,
  OrderStatus,
  PaymentMethod,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_ITEMS,
  INITIAL_COMBOS,
  INITIAL_TABLES,
  INITIAL_STAFF,
} from './initial-data';

// Singleton in-memory state for development / standalone / fallback
class RestaurantStore {
  private static instance: RestaurantStore;

  public categories: MenuCategory[] = [...INITIAL_CATEGORIES];
  public items: MenuItem[] = [...INITIAL_ITEMS];
  public combos: Combo[] = [...INITIAL_COMBOS];
  public tables: RestaurantTable[] = [...INITIAL_TABLES];
  public staff: StaffProfile[] = [...INITIAL_STAFF];
  public sessions: Array<{ id: string; table_id: string; status: 'open' | 'billed' | 'closed'; opened_at: string }> = [
    { id: 'sess-01', table_id: 'table-01', status: 'open', opened_at: new Date().toISOString() },
    { id: 'sess-02', table_id: 'table-02', status: 'open', opened_at: new Date().toISOString() },
    { id: 'sess-04', table_id: 'table-04', status: 'open', opened_at: new Date().toISOString() },
    // Table 3 has NO open session by default to test read-only mode!
  ];
  public orders: Order[] = [];
  public orderItems: OrderItem[] = [];
  public bills: Bill[] = [];
  private orderCounter: number = 100;
  private billCounter: number = 1000;

  private constructor() {
    this.seedDemoOrders();
  }

  public static getInstance(): RestaurantStore {
    if (!RestaurantStore.instance) {
      RestaurantStore.instance = new RestaurantStore();
    }
    return RestaurantStore.instance;
  }

  private seedDemoOrders() {
    // Seed initial active order for Table 2 and Table 4 to show immediately on Waiter & Kitchen
    const now = new Date(Date.now() - 8 * 60000).toISOString();
    const order1Id = 'demo-order-1';
    const order1: Order = {
      id: order1Id,
      order_number: 101,
      table_id: 'table-02',
      status: 'preparing',
      source: 'customer',
      notes: 'Please make filter coffee less sweet',
      total_paise: 27000,
      created_at: now,
      updated_at: now,
    };

    const item1: OrderItem = {
      id: 'demo-item-1',
      order_id: order1Id,
      item_id: 'item-benne-dosa',
      item_name: 'Davangere Benne Dosa',
      price_paise: 9500,
      quantity: 2,
      dietary: 'veg',
      status: 'preparing',
      notes: 'Extra crisp',
      created_at: now,
    };

    const item2: OrderItem = {
      id: 'demo-item-2',
      order_id: order1Id,
      item_id: 'item-filter-coffee',
      item_name: 'Degree Filter Coffee',
      price_paise: 3500,
      quantity: 2,
      dietary: 'veg',
      status: 'preparing',
      notes: 'Less sweet',
      created_at: now,
    };

    const order2Id = 'demo-order-2';
    const order2Time = new Date(Date.now() - 3 * 60000).toISOString();
    const order2: Order = {
      id: order2Id,
      order_number: 102,
      table_id: 'table-04',
      status: 'approved',
      source: 'customer',
      notes: 'Hot',
      total_paise: 50000,
      created_at: order2Time,
      updated_at: order2Time,
    };

    const item3: OrderItem = {
      id: 'demo-item-3',
      order_id: order2Id,
      item_id: 'item-chicken-ghee-roast',
      item_name: 'Kundapura Chicken Ghee Roast',
      price_paise: 26000,
      quantity: 1,
      dietary: 'non_veg',
      status: 'approved',
      notes: 'Spicy',
      created_at: order2Time,
    };

    const item4: OrderItem = {
      id: 'demo-item-4',
      order_id: order2Id,
      item_id: 'item-chicken-donne-biryani',
      item_name: 'Shivaji Military Donne Biryani',
      price_paise: 24000,
      quantity: 1,
      dietary: 'non_veg',
      status: 'approved',
      notes: '',
      created_at: order2Time,
    };

    this.orders.push(order1, order2);
    this.orderItems.push(item1, item2, item3, item4);
  }

  // Table Helpers
  public getOpenSessionForTable(tableId: string) {
    return this.sessions.find(s => s.table_id === tableId && s.status === 'open');
  }

  public openTableSession(tableId: string) {
    const existing = this.getOpenSessionForTable(tableId);
    if (existing) return existing;
    const newSession = {
      id: `sess-${Date.now()}`,
      table_id: tableId,
      status: 'open' as const,
      opened_at: new Date().toISOString(),
    };
    this.sessions.push(newSession);
    this.updateTableStatus(tableId, 'occupied');
    return newSession;
  }

  public getTableByToken(token: string): RestaurantTable | undefined {
    return this.tables.find(t => t.active_token === token && t.is_active);
  }

  public getTableById(id: string): RestaurantTable | undefined {
    return this.tables.find(t => t.id === id);
  }

  public updateTableStatus(id: string, status: RestaurantTable['status']) {
    const table = this.tables.find(t => t.id === id);
    if (table) {
      table.status = status;
    }
  }

  public resetTableToken(id: string): string {
    const table = this.tables.find(t => t.id === id);
    if (!table) throw new Error('Table not found');
    const randomHex = Math.random().toString(36).substring(2, 8);
    table.active_token = `tbl-manasu-${randomHex}`;
    table.status = 'vacant';
    return table.active_token;
  }

  // Menu Helpers
  public getActiveCategories(): MenuCategory[] {
    return this.categories
      .filter(c => c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  public getAvailableItems(): MenuItem[] {
    return this.items
      .filter(i => i.is_available)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  public getItemById(id: string): MenuItem | undefined {
    return this.items.find(i => i.id === id);
  }

  public getComboById(id: string): Combo | undefined {
    return this.combos.find(c => c.id === id);
  }

  // Customer / Waiter Place Order
  public placeOrder(params: {
    tableId: string;
    source: 'customer' | 'waiter';
    waiterId?: string;
    notes?: string;
    items: Array<{ itemId?: string; comboId?: string; quantity: number; notes?: string }>;
  }): { order: Order; items: OrderItem[] } {
    const table = this.getTableById(params.tableId);
    if (!table) throw new Error('Table not found');

    let totalPaise = 0;
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newOrderNumber = ++this.orderCounter;
    const createdItems: OrderItem[] = [];

    for (const reqItem of params.items) {
      if (reqItem.itemId) {
        const item = this.getItemById(reqItem.itemId);
        if (!item || !item.is_available) {
          throw new Error(`Item ${reqItem.itemId} is unavailable`);
        }
        const itemTotal = item.price_paise * reqItem.quantity;
        totalPaise += itemTotal;

        const orderItem: OrderItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          order_id: orderId,
          item_id: item.id,
          item_name: item.name,
          price_paise: item.price_paise, // strict server snapshot
          quantity: reqItem.quantity,
          dietary: item.dietary,
          status: params.source === 'waiter' ? 'approved' : 'pending',
          notes: reqItem.notes || '',
          created_at: new Date().toISOString(),
        };
        createdItems.push(orderItem);
      } else if (reqItem.comboId) {
        const combo = this.getComboById(reqItem.comboId);
        if (!combo || !combo.is_available) {
          throw new Error(`Combo ${reqItem.comboId} is unavailable`);
        }
        const itemTotal = combo.price_paise * reqItem.quantity;
        totalPaise += itemTotal;

        const orderItem: OrderItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          order_id: orderId,
          combo_id: combo.id,
          item_name: combo.name,
          price_paise: combo.price_paise, // strict server snapshot
          quantity: reqItem.quantity,
          dietary: combo.dietary,
          status: params.source === 'waiter' ? 'approved' : 'pending',
          notes: reqItem.notes || '',
          created_at: new Date().toISOString(),
        };
        createdItems.push(orderItem);
      }
    }

    const newOrder: Order = {
      id: orderId,
      order_number: newOrderNumber,
      table_id: params.tableId,
      status: params.source === 'waiter' ? 'approved' : 'pending',
      source: params.source,
      waiter_id: params.waiterId,
      notes: params.notes || '',
      total_paise: totalPaise,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.orders.unshift(newOrder);
    this.orderItems.push(...createdItems);
    this.updateTableStatus(params.tableId, 'occupied');

    return { order: newOrder, items: createdItems };
  }

  // Update order or item status
  public updateOrderStatus(orderId: string, status: OrderStatus): Order | undefined {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return undefined;
    order.status = status;
    order.updated_at = new Date().toISOString();

    // Propagate status to items
    this.orderItems
      .filter(i => i.order_id === orderId)
      .forEach(i => {
        i.status = status;
      });

    return order;
  }

  public updateOrderItemStatus(itemId: string, status: OrderStatus): OrderItem | undefined {
    const item = this.orderItems.find(i => i.id === itemId);
    if (!item) return undefined;
    item.status = status;
    return item;
  }

  // Settle Bill
  public settleBill(params: {
    tableId: string;
    paymentMethod: PaymentMethod;
    discountPaise?: number;
    settledBy?: string;
  }): Bill {
    const table = this.getTableById(params.tableId);
    if (!table) throw new Error('Table not found');

    const tableOrders = this.orders.filter(
      o => o.table_id === params.tableId && o.status !== 'cancelled'
    );
    if (tableOrders.length === 0) {
      throw new Error('No orders found for this table');
    }

    const subtotalPaise = tableOrders.reduce((sum, o) => sum + o.total_paise, 0);
    // 5% GST (2.5% CGST + 2.5% SGST standard for restaurant service in India)
    const taxPaise = Math.round(subtotalPaise * 0.05);
    const discountPaise = params.discountPaise || 0;
    const finalPaise = Math.max(0, subtotalPaise + taxPaise - discountPaise);

    const billId = `bill-${Date.now()}`;
    const newBill: Bill = {
      id: billId,
      bill_number: ++this.billCounter,
      table_id: params.tableId,
      subtotal_paise: subtotalPaise,
      tax_paise: taxPaise,
      discount_paise: discountPaise,
      final_paise: finalPaise,
      payment_method: params.paymentMethod,
      settled_by: params.settledBy,
      created_at: new Date().toISOString(),
      table: table,
      items: this.orderItems.filter(i => tableOrders.some(o => o.id === i.order_id)),
    };

    this.bills.unshift(newBill);

    // Mark orders as served/settled
    tableOrders.forEach(o => {
      o.status = 'served';
    });
    this.updateTableStatus(params.tableId, 'billed');

    return newBill;
  }
}

export const dbStore = RestaurantStore.getInstance();
