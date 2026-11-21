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
  public sessions: Array<{
    id: string;
    table_id: string;
    status: 'open' | 'billed' | 'closed';
    access_code?: string;
    code_attempts?: number;
    code_locked_until?: string | null;
    opened_at: string;
    closed_at?: string;
  }> = [
    { id: 'sess-01', table_id: 'table-01', status: 'open', access_code: '4819', code_attempts: 0, opened_at: new Date().toISOString() },
    { id: 'sess-02', table_id: 'table-02', status: 'open', access_code: '5923', code_attempts: 0, opened_at: new Date().toISOString() },
    { id: 'sess-03', table_id: 'table-03', status: 'open', access_code: '3184', code_attempts: 0, opened_at: new Date().toISOString() },
    { id: 'sess-04', table_id: 'table-04', status: 'open', access_code: '7461', code_attempts: 0, opened_at: new Date().toISOString() },
    { id: 'sess-05', table_id: 'table-05', status: 'open', access_code: '2895', code_attempts: 0, opened_at: new Date().toISOString() },
    { id: 'sess-06', table_id: 'table-06', status: 'open', access_code: '9032', code_attempts: 0, opened_at: new Date().toISOString() },
  ];
  public devices: Array<{
    id: string;
    session_id: string;
    device_id: string;
    device_name?: string;
    joined_at: string;
    removed_at?: string | null;
    is_active: boolean;
  }> = [];
  public settings = {
    id: 1,
    restaurant_name: 'Manasu restaurant',
    tagline: '[DEMO DATA] South Indian Biryani',
    about_text: '[DEMO DATA] Authentic South Indian dum biryanis, kebabs, and traditional meals in Bengaluru.',
    opening_hours: 'Monday - Sunday: 11:30 AM - 11:00 PM',
    maps_url: 'https://maps.google.com/?q=Bengaluru',
    address: 'Indiranagar, Bengaluru, India',
    phone: '+91 98450 12345',
    photos: [] as string[],
    large_order_threshold_paise: 500000,
    gstin: '29AABCM8291Q1ZP',
    tax_percent: 5.0,
    bill_footer: 'Thank you for dining at Manasu! Visit again.',
    paper_width: '80mm' as '80mm' | '58mm',
  };
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
    const now = new Date().toISOString();
    // Demo session for Table T03 (multi-customer simultaneous QR order testing)
    this.sessions = [
      {
        id: 'sess-demo-t03',
        table_id: 'table-03',
        status: 'open',
        opened_at: now,
      },
      {
        id: 'sess-demo-t07',
        table_id: 'table-07',
        status: 'open',
        opened_at: now,
      },
    ];

    // Customer devices/sessions for Table T03: Rahul, Arjun, Priya
    this.devices = [
      {
        id: 'dev-demo-rahul',
        session_id: 'sess-demo-t03',
        device_id: 'dev-token-rahul',
        device_name: 'Rahul',
        joined_at: now,
        is_active: true,
      },
      {
        id: 'dev-demo-arjun',
        session_id: 'sess-demo-t03',
        device_id: 'dev-token-arjun',
        device_name: 'Arjun',
        joined_at: now,
        is_active: true,
      },
      {
        id: 'dev-demo-priya',
        session_id: 'sess-demo-t03',
        device_id: 'dev-token-priya',
        device_name: 'Priya',
        joined_at: now,
        is_active: true,
      },
    ];

    // Multi-customer demo orders on Table T03
    this.orders = [
      // 1. Rahul's order (placed)
      {
        id: 'ord-demo-101',
        order_number: 101,
        table_id: 'table-03',
        table_session_id: 'sess-demo-t03',
        customer_session_id: 'dev-demo-rahul',
        customer_name: 'Rahul',
        status: 'placed',
        source: 'customer',
        notes: '[DEMO DATA] Please serve biryani piping hot',
        total_paise: 26000,
        created_at: new Date(Date.now() - 12 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 12 * 60000).toISOString(),
        items: [
          {
            id: 'item-demo-101-1',
            order_id: 'ord-demo-101',
            item_id: 'item-chicken-dum-biryani',
            item_name: 'Chicken Dum Biryani',
            price_paise: 22000,
            quantity: 1,
            dietary: 'non_veg',
            status: 'placed',
            created_at: new Date(Date.now() - 12 * 60000).toISOString(),
          },
          {
            id: 'item-demo-101-2',
            order_id: 'ord-demo-101',
            item_id: 'item-coke',
            item_name: 'Coke',
            price_paise: 4000,
            quantity: 1,
            dietary: 'veg',
            status: 'placed',
            created_at: new Date(Date.now() - 12 * 60000).toISOString(),
          },
        ],
      },
      // 2. Arjun's order (preparing)
      {
        id: 'ord-demo-102',
        order_number: 102,
        table_id: 'table-03',
        table_session_id: 'sess-demo-t03',
        customer_session_id: 'dev-demo-arjun',
        customer_name: 'Arjun',
        status: 'preparing',
        source: 'customer',
        notes: '[DEMO DATA] Extra raita with biryani',
        total_paise: 19000,
        created_at: new Date(Date.now() - 9 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
        items: [
          {
            id: 'item-demo-102-1',
            order_id: 'ord-demo-102',
            item_id: 'item-paneer-biryani',
            item_name: 'Paneer Biryani',
            price_paise: 19000,
            quantity: 1,
            dietary: 'veg',
            status: 'preparing',
            created_at: new Date(Date.now() - 9 * 60000).toISOString(),
          },
        ],
      },
      // 3. Priya's order (ready)
      {
        id: 'ord-demo-103',
        order_number: 103,
        table_id: 'table-03',
        table_session_id: 'sess-demo-t03',
        customer_session_id: 'dev-demo-priya',
        customer_name: 'Priya',
        status: 'ready',
        source: 'customer',
        notes: '[DEMO DATA] Quick starter',
        total_paise: 21000,
        created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 60000).toISOString(),
        items: [
          {
            id: 'item-demo-103-1',
            order_id: 'ord-demo-103',
            item_id: 'item-chicken-65',
            item_name: 'Chicken 65',
            price_paise: 18000,
            quantity: 1,
            dietary: 'non_veg',
            status: 'ready',
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
          },
          {
            id: 'item-demo-103-2',
            order_id: 'ord-demo-103',
            item_id: 'item-buttermilk',
            item_name: 'Buttermilk',
            price_paise: 3000,
            quantity: 1,
            dietary: 'veg',
            status: 'ready',
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
          },
        ],
      },
      // 4. Waiter Ramesh's order on Table T07 (served)
      {
        id: 'ord-demo-104',
        order_number: 104,
        table_id: 'table-07',
        table_session_id: 'sess-demo-t07',
        waiter_id: 'staff-waiter',
        waiter_name: 'Ramesh Gowda',
        status: 'served',
        source: 'waiter',
        notes: '[DEMO DATA] Dine-in guest order',
        total_paise: 64000,
        created_at: new Date(Date.now() - 25 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 10 * 60000).toISOString(),
        items: [
          {
            id: 'item-demo-104-1',
            order_id: 'ord-demo-104',
            item_id: 'item-mutton-dum-biryani',
            item_name: 'Mutton Dum Biryani',
            price_paise: 32000,
            quantity: 1,
            dietary: 'non_veg',
            status: 'served',
            created_at: new Date(Date.now() - 25 * 60000).toISOString(),
          },
          {
            id: 'item-demo-104-2',
            order_id: 'ord-demo-104',
            item_id: 'item-andhra-chicken-curry',
            item_name: 'Andhra Chicken Curry',
            price_paise: 24000,
            quantity: 1,
            dietary: 'non_veg',
            status: 'served',
            created_at: new Date(Date.now() - 25 * 60000).toISOString(),
          },
          {
            id: 'item-demo-104-3',
            order_id: 'ord-demo-104',
            item_id: 'item-butter-naan',
            item_name: 'Butter Naan',
            price_paise: 4000,
            quantity: 2,
            dietary: 'veg',
            status: 'served',
            created_at: new Date(Date.now() - 25 * 60000).toISOString(),
          },
        ],
      },
    ];
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
      if (!existing.access_code) {
        existing.access_code = Math.floor(1000 + Math.random() * 9000).toString();
      }
      return existing;
    }
    const access_code = Math.floor(1000 + Math.random() * 9000).toString();
    const newSession = {
      id: `sess-${Date.now()}`,
      table_id: tableId,
      status: 'open' as const,
      access_code,
      code_attempts: 0,
      code_locked_until: null,
      opened_at: new Date().toISOString(),
    };
    this.sessions.push(newSession);
    this.updateTableStatus(tableId, 'occupied');
    return newSession;
  }

  public resetSessionCode(tableId: string): string {
    const session = this.getOpenSessionForTable(tableId);
    if (!session) throw new Error('No open session found for table');
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    session.access_code = newCode;
    session.code_attempts = 0;
    session.code_locked_until = null;

    // Deactivate all joined devices for this session
    this.devices = this.devices.map(d =>
      d.session_id === session.id ? { ...d, is_active: false, removed_at: new Date().toISOString() } : d
    );
    return newCode;
  }

  public removeJoinedDevice(sessionId: string, deviceId: string) {
    this.devices = this.devices.map(d =>
      d.session_id === sessionId && d.device_id === deviceId
        ? { ...d, is_active: false, removed_at: new Date().toISOString() }
        : d
    );
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
    return this.tables.find(t => (t.active_token === token || t.id === token) && t.is_active);
  }

  public getTableById(id: string): RestaurantTable | undefined {
    if (!id) return undefined;
    const direct = this.tables.find(t => t.id === id || t.active_token === id);
    if (direct) return direct;

    const numMatch = id.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : null;

    return this.tables.find(t => {
      if (t.table_number.toLowerCase() === id.toLowerCase()) return true;
      if (t.table_number.toLowerCase() === `table ${id}`.toLowerCase()) return true;
      if (t.table_number.toLowerCase().replace(/^table\s*/i, '') === id.toLowerCase()) return true;
      if (num !== null) {
        const tDigits = t.table_number.replace(/\D/g, '') || t.id.replace(/\D/g, '');
        if (tDigits && parseInt(tDigits, 10) === num) return true;
      }
      return false;
    });
  }

  public getOrCreateTable(id: string, label?: string): RestaurantTable {
    const existing = this.getTableById(id);
    if (existing) return existing;

    const numMatch = (label || id).match(/\d+/);
    const numStr = numMatch ? numMatch[0] : '1';
    const cleanLabel = (label || `Table ${numStr}`).replace(/^(Table\s*)+/i, 'Table ');

    const newTable: RestaurantTable = {
      id,
      table_number: cleanLabel,
      seat_capacity: 4,
      active_token: `tbl-${id}`,
      status: 'occupied',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.tables.push(newTable);
    return newTable;
  }

  public updateTableStatus(id: string, status: RestaurantTable['status']) {
    const table = this.getTableById(id);
    if (table) {
      table.status = status;
    }
  }

  public resetTableToken(id: string): string {
    let table = this.getTableById(id);
    if (!table) {
      table = this.getOrCreateTable(id);
    }
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
    idempotencyKey?: string;
    items: Array<{ itemId?: string; comboId?: string; quantity: number; notes?: string }>;
  }): { order: Order; items: OrderItem[] } {
    if (params.idempotencyKey) {
      const existing = (this.orders as any[]).find(o => o.idempotency_key === params.idempotencyKey);
      if (existing) {
        const existingLines = this.orderItems.filter(oi => oi.order_id === existing.id);
        return { order: existing, items: existingLines };
      }
    }

    let table = this.getTableById(params.tableId);
    if (!table) {
      table = this.getOrCreateTable(params.tableId);
    }

    let totalPaise = 0;
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newOrderNumber = ++this.orderCounter;
    const createdItems: OrderItem[] = [];

    for (const reqItem of params.items) {
      if (reqItem.itemId) {
        const id = reqItem.itemId;
        let item = this.getItemById(id);
        if (!item) {
          item = this.items.find(
            i => i.id === id || i.name.toLowerCase() === id.toLowerCase()
          );
        }
        const unitPrice = item ? item.price_paise : 12000;
        const itemName = item ? item.name : 'South Indian Dish';
        const itemDietary = item ? item.dietary : 'veg';

        const itemTotal = unitPrice * reqItem.quantity;
        totalPaise += itemTotal;

        const orderItem: OrderItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          order_id: orderId,
          item_id: item ? item.id : reqItem.itemId,
          item_name: itemName,
          price_paise: unitPrice,
          quantity: reqItem.quantity,
          dietary: itemDietary,
          status: 'placed',
          notes: reqItem.notes || '',
          created_at: new Date().toISOString(),
        };
        createdItems.push(orderItem);
      } else if (reqItem.comboId) {
        let combo = this.getComboById(reqItem.comboId);
        if (!combo) {
          combo = this.combos.find(c => c.id === reqItem.comboId);
        }
        const unitPrice = combo ? combo.price_paise : 15000;
        const comboName = combo ? combo.name : 'Combo Meal';

        const comboTotal = unitPrice * reqItem.quantity;
        totalPaise += comboTotal;

        const orderItem: OrderItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          order_id: orderId,
          combo_id: combo ? combo.id : reqItem.comboId,
          item_name: comboName,
          price_paise: unitPrice,
          quantity: reqItem.quantity,
          dietary: combo ? combo.dietary : 'veg',
          status: 'placed',
          notes: reqItem.notes || '',
          created_at: new Date().toISOString(),
        };
        createdItems.push(orderItem);
      }
    }

    const threshold = this.settings.large_order_threshold_paise || 500000;
    const isLargeOrder = totalPaise > threshold;

    const newOrder: any = {
      id: orderId,
      order_number: newOrderNumber,
      table_id: params.tableId,
      status: 'placed',
      source: params.source,
      waiter_id: params.waiterId,
      notes: params.notes || '',
      total_paise: totalPaise,
      idempotency_key: params.idempotencyKey,
      needs_confirmation: isLargeOrder,
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
    let table = this.getTableById(params.tableId);
    if (!table) {
      table = this.getOrCreateTable(params.tableId);
    }

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
