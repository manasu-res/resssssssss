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
  public sessions: Array<{ id: string; table_id: string; status: 'open' | 'billed' | 'closed'; opened_at: string; closed_at?: string }> = [
    { id: 'sess-01', table_id: 'table-01', status: 'open', opened_at: new Date().toISOString() },
    { id: 'sess-02', table_id: 'table-02', status: 'open', opened_at: new Date().toISOString() },
    { id: 'sess-03', table_id: 'table-03', status: 'open', opened_at: new Date().toISOString() },
    { id: 'sess-04', table_id: 'table-04', status: 'open', opened_at: new Date().toISOString() },
    { id: 'sess-05', table_id: 'table-05', status: 'open', opened_at: new Date().toISOString() },
    { id: 'sess-06', table_id: 'table-06', status: 'open', opened_at: new Date().toISOString() },
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

    // Seed a cancelled order to spot problems in reports
    const cancelledTime = new Date(Date.now() - 45 * 60000).toISOString();
    const cancelledOrder: Order = {
      id: 'demo-order-cancelled-1',
      order_number: 99,
      table_id: 'table-03',
      status: 'cancelled',
      source: 'customer',
      notes: '[Rejected: Item out of stock - Neer Dosa]',
      total_paise: 18000,
      created_at: cancelledTime,
      updated_at: cancelledTime,
    };

    const cancelledItem: OrderItem = {
      id: 'demo-item-c1',
      order_id: 'demo-order-cancelled-1',
      item_id: 'item-neer-dosa',
      item_name: 'Neer Dosa (3 pcs)',
      price_paise: 9000,
      quantity: 2,
      dietary: 'veg',
      status: 'cancelled',
      notes: 'Customer left due to wait time',
      created_at: cancelledTime,
    };

    this.orders.push(order1, order2, cancelledOrder);
    this.orderItems.push(item1, item2, item3, item4, cancelledItem);

    // Seed historical demo bills for reports
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 3600000);
    const twoDaysAgo = new Date(Date.now() - 48 * 3600000);
    const threeDaysAgo = new Date(Date.now() - 72 * 3600000);

    const demoBill1: Bill = {
      id: 'bill-demo-01',
      bill_number: '0001',
      table_id: 'table-01',
      subtotal_paise: 42000,
      tax_paise: 2100,
      discount_paise: 0,
      final_paise: 44100,
      payment_method: 'upi',
      created_at: new Date(today.getTime() - 2 * 3600000).toISOString(),
      table: this.tables[0],
      items: [
        { id: 'bi-1', order_id: 'b-o-1', item_name: 'Davangere Benne Dosa', price_paise: 9500, quantity: 2, dietary: 'veg', status: 'served', created_at: today.toISOString() },
        { id: 'bi-2', order_id: 'b-o-1', item_name: 'Shivaji Military Donne Biryani', price_paise: 24000, quantity: 1, dietary: 'non_veg', status: 'served', created_at: today.toISOString() },
      ],
    };

    const demoBill2: Bill = {
      id: 'bill-demo-02',
      bill_number: '0002',
      table_id: 'table-05',
      subtotal_paise: 35000,
      tax_paise: 1750,
      discount_paise: 0,
      final_paise: 36750,
      payment_method: 'cash',
      created_at: new Date(today.getTime() - 1 * 3600000).toISOString(),
      table: this.tables[4],
      items: [
        { id: 'bi-3', order_id: 'b-o-2', item_name: 'South Bengaluru Breakfast Combo', price_paise: 11000, quantity: 2, dietary: 'veg', status: 'served', created_at: today.toISOString() },
        { id: 'bi-4', order_id: 'b-o-2', item_name: 'Degree Filter Coffee', price_paise: 3500, quantity: 2, dietary: 'veg', status: 'served', created_at: today.toISOString() },
      ],
    };

    const demoBill3: Bill = {
      id: 'bill-demo-03',
      bill_number: '0089',
      table_id: 'table-02',
      subtotal_paise: 72000,
      tax_paise: 3600,
      discount_paise: 0,
      final_paise: 75600,
      payment_method: 'card',
      created_at: yesterday.toISOString(),
      table: this.tables[1],
      items: [
        { id: 'bi-5', order_id: 'b-o-3', item_name: 'Military Donne Biryani Feast', price_paise: 38000, quantity: 1, dietary: 'non_veg', status: 'served', created_at: yesterday.toISOString() },
        { id: 'bi-6', order_id: 'b-o-3', item_name: 'Kundapura Chicken Ghee Roast', price_paise: 26000, quantity: 1, dietary: 'non_veg', status: 'served', created_at: yesterday.toISOString() },
      ],
    };

    const demoBill4: Bill = {
      id: 'bill-demo-04',
      bill_number: '0084',
      table_id: 'table-06',
      subtotal_paise: 58000,
      tax_paise: 2900,
      discount_paise: 0,
      final_paise: 60900,
      payment_method: 'upi',
      created_at: twoDaysAgo.toISOString(),
      table: this.tables[5],
      items: [
        { id: 'bi-7', order_id: 'b-o-4', item_name: 'Mutton Donne Biryani', price_paise: 31000, quantity: 1, dietary: 'non_veg', status: 'served', created_at: twoDaysAgo.toISOString() },
        { id: 'bi-8', order_id: 'b-o-4', item_name: 'Degree Filter Coffee', price_paise: 3500, quantity: 4, dietary: 'veg', status: 'served', created_at: twoDaysAgo.toISOString() },
      ],
    };

    const demoBill5: Bill = {
      id: 'bill-demo-05',
      bill_number: '0078',
      table_id: 'table-03',
      subtotal_paise: 88000,
      tax_paise: 4400,
      discount_paise: 0,
      final_paise: 92400,
      payment_method: 'cash',
      created_at: threeDaysAgo.toISOString(),
      table: this.tables[2],
      items: [
        { id: 'bi-9', order_id: 'b-o-5', item_name: 'Military Donne Biryani Feast', price_paise: 38000, quantity: 2, dietary: 'non_veg', status: 'served', created_at: threeDaysAgo.toISOString() },
      ],
    };

    this.bills.push(demoBill1, demoBill2, demoBill3, demoBill4, demoBill5);
  }

  // Table Helpers
  public getOpenSessionForTable(tableId: string) {
    return this.sessions.find(s => s.table_id === tableId && (s.status === 'open' || s.status === 'billed'));
  }

  public openTableSession(tableId: string) {
    const existing = this.getOpenSessionForTable(tableId);
    if (existing) {
      if (existing.status === 'billed') {
        existing.status = 'open';
      }
      return existing;
    }
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

  public closeTableSession(tableId: string) {
    const session = this.getOpenSessionForTable(tableId);
    if (session) {
      session.status = 'closed';
      session.closed_at = new Date().toISOString();
    }
    this.updateTableStatus(tableId, 'vacant');
    return session;
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
    // Zero tax (0% GST)
    const taxPaise = 0;
    const discountPaise = params.discountPaise || 0;
    const finalPaise = Math.max(0, subtotalPaise - discountPaise);

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

    // Mark session as billed
    const session = this.getOpenSessionForTable(params.tableId);
    if (session) {
      session.status = 'billed';
    }

    // Mark orders as served/settled
    tableOrders.forEach(o => {
      o.status = 'served';
    });
    this.updateTableStatus(params.tableId, 'billed');

    return newBill;
  }
}

export const dbStore = RestaurantStore.getInstance();
