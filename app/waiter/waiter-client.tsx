'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatRupees, formatTimeAgo, formatDateShort, formatTimeOnly } from '@/lib/format';
import { DietaryBadge } from '@/components/ui/dietary-badge';
import { ThermalReceipt } from '@/components/billing/thermal-receipt';
import type { StaffAuthResult } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/client';

export interface OrderLineItem {
  id: string;
  item_name?: string;
  name_snapshot?: string;
  price_paise?: number;
  price_snapshot?: number;
  quantity: number;
  notes?: string;
  note?: string;
}

export interface TableOrder {
  id: string;
  order_number?: number;
  status: 'pending' | 'approved' | 'preparing' | 'ready' | 'served' | 'cancelled';
  source?: 'customer' | 'waiter';
  notes?: string;
  created_at: string;
  total_paise?: number;
  order_lines?: OrderLineItem[];
  items?: OrderLineItem[];
}

export interface WaiterTable {
  id: string;
  label: string;
  table_number: string;
  qr_token: string;
  state: 'Free' | 'Open' | 'Order waiting' | 'Billed';
  session: { id: string; status: string; opened_at: string } | null;
  opened_at: string | null;
  running_total_paise: number;
  currentTotalPaise: number;
  pending_orders_count: number;
  pendingOrdersCount: number;
  orders: TableOrder[];
  activeOrders: TableOrder[];
}

interface MenuItemData {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  price?: number;
  price_paise: number;
  dietary?: 'veg' | 'non_veg';
  is_veg?: boolean;
  is_available?: boolean;
}

interface ComboData {
  id: string;
  name: string;
  description?: string;
  price?: number;
  price_paise: number;
  dietary?: 'veg' | 'non_veg';
  is_veg?: boolean;
  is_available?: boolean;
}

interface CategoryData {
  id: string;
  name: string;
  sort_order: number;
}

interface RestaurantSettings {
  restaurant_name: string;
  address: string;
  phone: string;
  gstin: string | null;
  tax_percent: number;
  bill_footer: string;
  paper_width: '80mm' | '58mm';
}

interface WaiterClientProps {
  staff: StaffAuthResult;
}

// Web Audio API notification chime (synthesized 2-tone restaurant bell, works offline, no external file)
function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch {
    // Ignore if audio context not permitted before first user gesture
  }
}

export default function WaiterClient({ staff: currentStaff }: WaiterClientProps) {
  const router = useRouter();
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Filter: 'all', 'waiting', 'open', 'billed', 'free'
  const [filter, setFilter] = useState<'all' | 'waiting' | 'open' | 'billed' | 'free'>('all');

  // Menu data for taking verbal orders
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [combos, setCombos] = useState<ComboData[]>([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [itemSearch, setItemSearch] = useState<string>('');

  // Restaurant settings (tax percent, GSTIN, etc.)
  const [settings, setSettings] = useState<RestaurantSettings>({
    restaurant_name: 'Manasu Restaurant',
    address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    phone: '+91 80 2520 1980',
    gstin: '29AABCM8291Q1ZP',
    tax_percent: 0,
    bill_footer: 'Thank you for dining at Manasu! Visit again.',
    paper_width: '80mm',
  });

  // Waiter add-order state
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [orderCart, setOrderCart] = useState<Array<{ id: string; type: 'item' | 'combo'; name: string; price: number; quantity: number }>>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Billing preview & Mark Paid state
  const [isBillingPreview, setIsBillingPreview] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'card'>('upi');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [activeBill, setActiveBill] = useState<any | null>(null);

  // Discount options: 'none' | 'percent' | 'flat'
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'flat'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Past Bills Drawer state
  const [isPastBillsOpen, setIsPastBillsOpen] = useState(false);
  const [pastBills, setPastBills] = useState<any[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  // Reject order modal state
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Item out of stock');
  const [customReason, setCustomReason] = useState('');

  // Cancel bill modal state
  const [cancellingBillId, setCancellingBillId] = useState<string | null>(null);
  const [cancelBillReason, setCancelBillReason] = useState('');

  // Previous pending count to detect new incoming orders for chime
  const prevPendingCountRef = useRef<number>(0);

  // Preserve tables that were opened in this browser session so polling never flips them back to 'Free'
  const locallyOpenedTablesRef = useRef<Record<string, number>>({});

  // Preserve order status changes made locally (approved, served, cancelled) so background polls never glitch back
  const localOrderStatusRef = useRef<Record<string, string>>({});

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/waiter/tables');
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      const rawTables: WaiterTable[] = data.tables || [];
      const loadedTables = rawTables.map(t => {
        const effectiveState = (locallyOpenedTablesRef.current[t.id] && t.state === 'Free')
          ? ('Open' as const)
          : t.state;

        const updatedOrders = (t.orders || []).map((o: any) => {
          const override = localOrderStatusRef.current[o.id];
          return override ? { ...o, status: override } : o;
        });

        const updatedActive = (t.activeOrders || []).map((o: any) => {
          const override = localOrderStatusRef.current[o.id];
          return override ? { ...o, status: override } : o;
        });

        const pendingCount = updatedOrders.filter((o: any) => o.status === 'pending').length;

        return {
          ...t,
          state: effectiveState,
          orders: updatedOrders,
          activeOrders: updatedActive,
          pending_orders_count: pendingCount,
          pendingOrdersCount: pendingCount,
        };
      });
      setTables(loadedTables);

      // Total pending orders across all tables
      const totalPending = loadedTables.reduce(
        (sum, t) => sum + (t.pending_orders_count || t.pendingOrdersCount || 0),
        0
      );

      // Trigger audio cue if new pending orders arrived
      if (totalPending > prevPendingCountRef.current && prevPendingCountRef.current >= 0) {
        playChime();
      }
      prevPendingCountRef.current = totalPending;
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/waiter/menu');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setMenuItems(data.items || []);
        setCombos(data.combos || []);
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  const fetchPastBills = async () => {
    setLoadingBills(true);
    try {
      const res = await fetch('/api/waiter/bills');
      if (res.ok) {
        const data = await res.json();
        setPastBills(data.bills || []);
      }
    } catch (err) {
      console.error('Failed to fetch past bills:', err);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchMenu();
    fetchSettings();

    // 1. Supabase Realtime subscription
    let channel: any = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel('waiter-realtime-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
          if (payload.eventType === 'INSERT' && (payload.new as any)?.status === 'pending') {
            playChime();
          }
          fetchTables();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => {
          fetchTables();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription skipped or unavailable:', e);
    }

    // 2. High-reliability polling fallback every 4s (tables) and 8s (menu)
    let pollTick = 0;
    const interval = setInterval(() => {
      fetchTables();
      pollTick++;
      if (pollTick % 2 === 0) {
        fetchMenu();
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      if (channel) {
        try {
          channel.unsubscribe();
        } catch {}
      }
    };
  }, [fetchTables, fetchMenu, fetchSettings]);

  const selectedTable = tables.find(t => t.id === selectedTableId) || null;

  // Table Session Actions
  const handleOpenTable = async (tableId: string) => {
    locallyOpenedTablesRef.current[tableId] = Date.now();
    // Optimistic UI update
    setTables(prev =>
      prev.map(t =>
        t.id === tableId
          ? { ...t, state: 'Open', opened_at: new Date().toISOString() }
          : t
      )
    );
    try {
      await fetch('/api/waiter/table/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId }),
      });
      await fetchTables();
    } catch (err) {
      console.error('Error opening table:', err);
    }
  };

  const handleOpenAndTakeOrder = async (tableId: string) => {
    locallyOpenedTablesRef.current[tableId] = Date.now();
    // Optimistic UI update
    setTables(prev =>
      prev.map(t =>
        t.id === tableId
          ? { ...t, state: 'Open', opened_at: new Date().toISOString() }
          : t
      )
    );
    setIsAddingItems(true);
    setIsBillingPreview(false);
    fetchMenu();
    try {
      await fetch('/api/waiter/table/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId }),
      });
      await fetchTables();
    } catch (err) {
      console.error('Error opening table:', err);
    }
  };

  const handleVacateTable = async (tableId: string) => {
    if (!confirm('Vacate this table and clear active session?')) return;
    delete locallyOpenedTablesRef.current[tableId];
    // Optimistic UI update
    setTables(prev =>
      prev.map(t =>
        t.id === tableId
          ? {
              ...t,
              state: 'Free',
              session: null,
              opened_at: null,
              orders: [],
              activeOrders: [],
              running_total_paise: 0,
              currentTotalPaise: 0,
              pending_orders_count: 0,
              pendingOrdersCount: 0,
            }
          : t
      )
    );
    setSelectedTableId(null);
    setIsAddingItems(false);
    setIsBillingPreview(false);
    try {
      await fetch('/api/waiter/table/vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, resetToken: true }),
      });
      await fetchTables();
    } catch (err) {
      console.error('Error vacating table:', err);
    }
  };

  // Order Approval & Status Actions
  const handleUpdateOrderStatus = async (orderId: string, status: 'approved' | 'cancelled' | 'served', reason?: string) => {
    localOrderStatusRef.current[orderId] = status;
    // Optimistic UI update
    setTables(prev =>
      prev.map(t => {
        const updatedOrders = (t.orders || []).map((o: any) =>
          o.id === orderId ? { ...o, status } : o
        );
        const updatedActive = (t.activeOrders || []).map((o: any) =>
          o.id === orderId ? { ...o, status } : o
        );
        const pendingCount = updatedOrders.filter((o: any) => o.status === 'pending').length;
        return {
          ...t,
          orders: updatedOrders,
          activeOrders: updatedActive,
          pending_orders_count: pendingCount,
          pendingOrdersCount: pendingCount,
        };
      })
    );
    try {
      await fetch('/api/waiter/order/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status, reason }),
      });
      setRejectingOrderId(null);
      setCustomReason('');
      await fetchTables();
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  // Add Item to Waiter Direct Cart
  const handleAddItemToCart = (item: MenuItemData) => {
    if (item.is_available === false) {
      alert(`"${item.name}" is sold out and cannot be ordered.`);
      return;
    }
    const price = item.price ?? item.price_paise ?? 0;
    setOrderCart(prev => {
      const exist = prev.find(ci => ci.id === item.id && ci.type === 'item');
      if (exist) {
        return prev.map(ci => (ci.id === item.id && ci.type === 'item' ? { ...ci, quantity: ci.quantity + 1 } : ci));
      }
      return [...prev, { id: item.id, type: 'item', name: item.name, price, quantity: 1 }];
    });
  };

  const handleAddComboToCart = (combo: ComboData) => {
    if (combo.is_available === false) {
      alert(`"${combo.name}" is sold out and cannot be ordered.`);
      return;
    }
    const price = combo.price ?? combo.price_paise ?? 0;
    setOrderCart(prev => {
      const exist = prev.find(ci => ci.id === combo.id && ci.type === 'combo');
      if (exist) {
        return prev.map(ci => (ci.id === combo.id && ci.type === 'combo' ? { ...ci, quantity: ci.quantity + 1 } : ci));
      }
      return [...prev, { id: combo.id, type: 'combo', name: combo.name, price, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (id: string, type: 'item' | 'combo') => {
    setOrderCart(prev => {
      const exist = prev.find(ci => ci.id === id && ci.type === type);
      if (!exist) return prev;
      if (exist.quantity <= 1) {
        return prev.filter(ci => !(ci.id === id && ci.type === type));
      }
      return prev.map(ci => (ci.id === id && ci.type === type ? { ...ci, quantity: ci.quantity - 1 } : ci));
    });
  };

  const handleSubmitWaiterOrder = async () => {
    if (!selectedTable || orderCart.length === 0 || submittingOrder) return;

    // Check if any cart item is sold out
    const soldOutItem = orderCart.find(ci => {
      if (ci.type === 'item') {
        const found = menuItems.find(m => m.id === ci.id);
        return found && found.is_available === false;
      } else {
        const found = combos.find(c => c.id === ci.id);
        return found && found.is_available === false;
      }
    });

    if (soldOutItem) {
      alert(`Cannot place order: "${soldOutItem.name}" is sold out.`);
      return;
    }

    setSubmittingOrder(true);
    try {
      const payload = {
        tableId: selectedTable.id,
        notes: orderNotes.trim(),
        items: orderCart.map(ci => ({
          itemId: ci.type === 'item' ? ci.id : undefined,
          comboId: ci.type === 'combo' ? ci.id : undefined,
          quantity: ci.quantity,
        })),
      };

      const res = await fetch('/api/waiter/order/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setOrderCart([]);
        setOrderNotes('');
        setIsAddingItems(false);
        await fetchTables();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to place order');
      }
    } catch (err) {
      console.error('Error placing waiter order:', err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Bill Generation: "Mark paid"
  const handleMarkPaid = async () => {
    if (!selectedTable || markingPaid) return;
    setMarkingPaid(true);

    let finalDiscountPaise = 0;
    if (discountType === 'percent' && discountValue > 0) {
      finalDiscountPaise = Math.round(previewSubtotal * (discountValue / 100));
    } else if (discountType === 'flat' && discountValue > 0) {
      finalDiscountPaise = Math.round(discountValue * 100);
    }
    finalDiscountPaise = Math.min(previewSubtotal, Math.max(0, finalDiscountPaise));

    try {
      const res = await fetch('/api/waiter/bill/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          paymentMethod,
          discountPaise: finalDiscountPaise,
        }),
      });

      const data = await res.json();
      if (res.ok && data.bill) {
        setIsBillingPreview(false);
        setSelectedTableId(null);
        setDiscountType('none');
        setDiscountValue(0);
        // Open the print view with auto-print
        setActiveBill(data.bill);
        await fetchTables();
      } else {
        alert(data.error || 'Failed to mark bill paid');
      }
    } catch (err) {
      console.error('Error settling bill:', err);
    } finally {
      setMarkingPaid(false);
    }
  };

  // Cancel bill for corrections
  const handleCancelBill = async (billId: string) => {
    if (!cancelBillReason.trim()) {
      alert('Please provide a reason for cancelling this bill.');
      return;
    }
    try {
      const res = await fetch('/api/waiter/bill/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, reason: cancelBillReason.trim() }),
      });
      if (res.ok) {
        setCancellingBillId(null);
        setCancelBillReason('');
        await fetchPastBills();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel bill');
      }
    } catch (err) {
      console.error('Error cancelling bill:', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Calculate pending orders across all tables
  const totalWaitingOrders = tables.reduce(
    (sum, t) => sum + (t.pending_orders_count || t.pendingOrdersCount || 0),
    0
  );
  const waitingTables = tables.filter(t => t.state === 'Order waiting');

  // Filtered tables
  const filteredTables = tables.filter(t => {
    if (filter === 'waiting') return t.state === 'Order waiting';
    if (filter === 'open') return t.state === 'Open';
    if (filter === 'billed') return t.state === 'Billed';
    if (filter === 'free') return t.state === 'Free';
    return true;
  });

  // Calculate grouped lines and preview totals for selectedTable
  const nonCancelledOrders = selectedTable?.orders.filter(o => o.status !== 'cancelled') || [];
  const previewGroupedMap = new Map<string, { name: string; price: number; quantity: number }>();

  for (const o of nonCancelledOrders) {
    const lines = o.order_lines || o.items || [];
    for (const l of lines) {
      const name = l.name_snapshot || l.item_name || 'Item';
      const price = l.price_snapshot || l.price_paise || 0;
      const key = `${name}_${price}`;
      const existing = previewGroupedMap.get(key);
      if (existing) {
        existing.quantity += l.quantity;
      } else {
        previewGroupedMap.set(key, { name, price, quantity: l.quantity });
      }
    }
  }

  const previewGroupedLines = Array.from(previewGroupedMap.values());
  const previewSubtotal = previewGroupedLines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const previewTaxPercent = settings?.tax_percent ?? 0;
  const previewTaxAmount = Math.round(previewSubtotal * (previewTaxPercent / 100));

  let discountPaise = 0;
  if (discountType === 'percent' && discountValue > 0) {
    discountPaise = Math.round(previewSubtotal * (discountValue / 100));
  } else if (discountType === 'flat' && discountValue > 0) {
    discountPaise = Math.round(discountValue * 100);
  }
  discountPaise = Math.min(previewSubtotal, Math.max(0, discountPaise));
  const previewGrandTotal = Math.max(0, previewSubtotal + previewTaxAmount - discountPaise);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans select-none pb-12">
      {/* Top POS Header */}
      <header className="h-14 bg-ink text-paper px-4 flex items-center justify-between border-b border-black shrink-0 print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="font-serif text-lg font-bold tracking-tight">MANASU</span>
          <span className="text-[11px] uppercase tracking-widest bg-paper/20 px-2 py-0.5 rounded-sm font-semibold">
            WAITER POS
          </span>
          <span className="text-xs text-paper/70 hidden sm:inline">
            &middot; {currentStaff.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Past Bills Drawer Button */}
          <button
            type="button"
            onClick={() => {
              setIsPastBillsOpen(true);
              fetchPastBills();
            }}
            className="min-h-[44px] px-3.5 border border-paper/40 hover:border-paper text-xs rounded-sm flex items-center justify-center font-bold uppercase tracking-wider cursor-pointer"
          >
            Past Bills
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] px-3 border border-paper/30 hover:bg-paper/10 text-xs rounded-sm text-paper/80 font-semibold uppercase tracking-wider cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Visible High-Priority Alert Banner when any customer order is waiting */}
      {totalWaitingOrders > 0 && (
        <div
          role="alert"
          onClick={() => {
            if (waitingTables.length > 0) {
              setSelectedTableId(waitingTables[0].id);
            }
          }}
          className="bg-chilli text-white px-4 py-2.5 flex items-center justify-between cursor-pointer border-b border-black animate-pulse print:hidden"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-white text-chilli px-2 py-0.5 rounded-sm">
              ACTION REQUIRED
            </span>
            <span className="text-xs font-semibold">
              {totalWaitingOrders} order{totalWaitingOrders > 1 ? 's' : ''} waiting for approval on{' '}
              {waitingTables.map(t => t.table_number).join(', ')}
            </span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider underline">
            Review &rarr;
          </span>
        </div>
      )}

      {/* State Filter Bar */}
      <nav aria-label="Table status filters" className="px-4 py-2 bg-paper-subtle border-b border-rule flex items-center gap-2 overflow-x-auto shrink-0 print:hidden">
        <span className="text-xs uppercase tracking-wider text-ink-muted font-bold shrink-0">
          Tables:
        </span>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`min-h-[48px] px-3.5 text-xs font-bold rounded-sm uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-ink text-paper' : 'border border-rule bg-white text-ink'
          }`}
        >
          All ({tables.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('waiting')}
          className={`min-h-[48px] px-3.5 text-xs font-bold rounded-sm uppercase tracking-wider shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
            filter === 'waiting'
              ? 'bg-chilli text-white'
              : 'border border-chilli bg-chilli-light text-chilli'
          }`}
        >
          <span>Order waiting</span>
          <span className="px-1.5 py-0.5 bg-white text-chilli rounded-sm font-extrabold text-[11px]">
            {totalWaitingOrders}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('open')}
          className={`min-h-[48px] px-3.5 text-xs font-bold rounded-sm uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
            filter === 'open'
              ? 'bg-emerald-800 text-white'
              : 'border border-emerald-600/40 bg-white text-emerald-900'
          }`}
        >
          Open ({tables.filter(t => t.state === 'Open').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('billed')}
          className={`min-h-[48px] px-3.5 text-xs font-bold rounded-sm uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
            filter === 'billed'
              ? 'bg-blue-800 text-white'
              : 'border border-blue-400 bg-white text-blue-900'
          }`}
        >
          Billed ({tables.filter(t => t.state === 'Billed').length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('free')}
          className={`min-h-[48px] px-3.5 text-xs font-bold rounded-sm uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
            filter === 'free' ? 'bg-stone-800 text-white' : 'border border-rule bg-white text-stone-700'
          }`}
        >
          Free ({tables.filter(t => t.state === 'Free').length})
        </button>
      </nav>

      {/* Floor Content: Split View on Desktop (lg:), Full Grid on Mobile/Tablet */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden print:hidden">
        {/* Main Grid: Tables */}
        <main className="p-3 sm:p-4 flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-20 text-center">
            <p className="font-serif text-base text-ink-muted animate-pulse">Loading restaurant floor tables...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-xs text-ink-muted">No tables match the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
            {filteredTables.map(tbl => {
              const totalPaise = tbl.running_total_paise || tbl.currentTotalPaise || 0;
              const pendingCount = tbl.pending_orders_count || tbl.pendingOrdersCount || 0;

              let stateBadge = {
                text: 'Free',
                badgeBg: 'bg-stone-200 text-stone-800 border-stone-300',
                cardBorder: 'border-rule bg-white hover:bg-paper-subtle',
              };

              if (tbl.state === 'Order waiting') {
                stateBadge = {
                  text: 'Order waiting',
                  badgeBg: 'bg-chilli text-white font-bold',
                  cardBorder: 'border-chilli ring-2 ring-chilli bg-chilli-light/40',
                };
              } else if (tbl.state === 'Open') {
                stateBadge = {
                  text: 'Open',
                  badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold',
                  cardBorder: 'border-emerald-700/50 bg-white hover:bg-emerald-50/30',
                };
              } else if (tbl.state === 'Billed') {
                stateBadge = {
                  text: 'Billed',
                  badgeBg: 'bg-blue-100 text-blue-900 border-blue-400 font-bold',
                  cardBorder: 'border-blue-400 bg-blue-50/40 hover:bg-blue-50/60',
                };
              }

              return (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => {
                    setSelectedTableId(tbl.id);
                    setIsAddingItems(false);
                    setIsBillingPreview(false);
                  }}
                  className={`min-h-[110px] sm:min-h-[120px] p-3 text-left border rounded-sm flex flex-col justify-between transition-all active:scale-[0.98] cursor-pointer ${
                    selectedTableId === tbl.id ? 'ring-2 ring-ink bg-paper-card' : ''
                  } ${stateBadge.cardBorder}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <span className="font-serif text-lg font-bold text-ink leading-tight block">
                        {tbl.table_number}
                      </span>
                      {tbl.opened_at && (
                        <span className="text-[11px] text-ink-muted font-medium">
                          Opened {formatTimeAgo(tbl.opened_at)}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${stateBadge.badgeBg}`}
                    >
                      {stateBadge.text}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-ink/10 flex items-baseline justify-between">
                    {tbl.state === 'Free' ? (
                      <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                        Tap to open &rarr;
                      </span>
                    ) : (
                      <>
                        <span className="text-sm font-bold tabular-nums text-ink">
                          {formatRupees(totalPaise)}
                        </span>
                        {pendingCount > 0 ? (
                          <span className="text-[11px] font-bold text-chilli uppercase">
                            {pendingCount} waiting
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-muted">
                            {tbl.orders.length} order{tbl.orders.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

        {/* Selected Table Detail: Split View on Desktop (lg:), Slide-Over Drawer on Mobile (< lg) */}
        {selectedTable ? (
          <div className="fixed inset-0 z-40 flex justify-end bg-ink/60 lg:bg-transparent lg:static lg:z-10 lg:w-[460px] xl:w-[500px] 2xl:w-[540px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-0 lg:shrink-0 print:hidden">
            <div className="w-full max-w-lg lg:max-w-none bg-paper border-l border-rule h-full flex flex-col shadow-none">
            {/* Drawer Header */}
            <div className="p-4 border-b border-rule bg-paper-subtle flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-bold text-ink">
                    {selectedTable.table_number}
                  </h2>
                  <span
                    className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-sm border ${
                      selectedTable.state === 'Order waiting'
                        ? 'bg-chilli text-white border-chilli'
                        : selectedTable.state === 'Open'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                        : selectedTable.state === 'Billed'
                        ? 'bg-blue-100 text-blue-900 border-blue-400'
                        : 'bg-stone-200 text-stone-800 border-stone-300'
                    }`}
                  >
                    {selectedTable.state}
                  </span>
                </div>
                {selectedTable.opened_at && (
                  <p className="text-xs text-ink-muted mt-0.5">
                    Opened {formatTimeAgo(selectedTable.opened_at)} &middot; Running total:{' '}
                    <strong className="text-ink font-bold tabular-nums">
                      {formatRupees(selectedTable.running_total_paise || selectedTable.currentTotalPaise || 0)}
                    </strong>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTableId(null);
                  setIsAddingItems(false);
                  setIsBillingPreview(false);
                }}
                className="w-12 h-12 flex items-center justify-center border border-rule rounded-sm text-base text-ink hover:bg-paper cursor-pointer"
                aria-label="Close table drawer"
              >
                &times;
              </button>
            </div>

            {/* Case 1: Table is Free (No session) -> Take Order or Open Table */}
            {selectedTable.state === 'Free' ? (
              <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-4">
                <div className="max-w-xs space-y-1.5">
                  <h3 className="font-serif text-lg font-bold text-ink">
                    Table is vacant
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Take an order directly or open this table for customer QR ordering.
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenAndTakeOrder(selectedTable.id)}
                    className="w-full min-h-[52px] bg-chilli hover:bg-chilli-hover text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    + Take order now
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenTable(selectedTable.id)}
                    className="w-full min-h-[44px] bg-white border border-ink/40 hover:bg-paper-subtle text-ink text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer flex items-center justify-center"
                  >
                    Open table (QR order)
                  </button>
                </div>
              </div>
            ) : (
              /* Case 2: Table is Open, Order waiting, or Billed */
              <>
                {/* POS Quick Action Toolbar (Min 48px tap targets) */}
                <div className="px-4 py-2 border-b border-rule bg-paper flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isAddingItems;
                      setIsAddingItems(next);
                      setIsBillingPreview(false);
                      if (next) {
                        fetchMenu();
                      }
                    }}
                    className={`min-h-[48px] flex-1 px-3 border text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                      isAddingItems
                        ? 'bg-chilli text-white border-chilli font-black'
                        : 'bg-white text-ink border-ink/50 hover:bg-paper-subtle'
                    }`}
                  >
                    {isAddingItems ? 'Close Menu' : '+ Take order'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsBillingPreview(!isBillingPreview);
                      setIsAddingItems(false);
                    }}
                    className={`min-h-[48px] flex-1 px-3 border text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                      isBillingPreview
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-white text-ink border-rule hover:bg-paper-subtle'
                    }`}
                  >
                    {isBillingPreview ? 'View orders' : 'Generate bill'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVacateTable(selectedTable.id)}
                    className="min-h-[48px] px-3.5 border border-rule hover:border-chilli hover:text-chilli text-xs font-bold uppercase tracking-wider rounded-sm text-ink-muted cursor-pointer"
                    title="Vacate and close table session"
                  >
                    Vacate
                  </button>
                </div>

                {/* Drawer Body Scroll Area */}
                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                  {/* Bill Preview Subview */}
                  {isBillingPreview && (
                    <div className="p-4 border border-ink bg-white rounded-sm space-y-4">
                      <div className="border-b pb-2 flex justify-between items-baseline">
                        <span className="text-xs uppercase tracking-wider font-black text-ink">
                          Bill Preview & Payment
                        </span>
                        <span className="text-xs text-ink-muted">
                          {selectedTable.table_number}
                        </span>
                      </div>

                      {/* Grouped Line Items */}
                      <div className="space-y-1.5 border-b pb-3">
                        <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block mb-1">
                          Consolidated Items:
                        </span>
                        {previewGroupedLines.length === 0 ? (
                          <p className="text-xs text-ink-muted italic">No items ordered yet.</p>
                        ) : (
                          previewGroupedLines.map((line, idx) => (
                            <div key={idx} className="flex justify-between items-baseline text-xs">
                              <span className="flex-1 pr-2">
                                <span className="font-bold">{line.quantity}&times;</span> {line.name}
                              </span>
                              <span className="tabular-nums font-semibold text-ink">
                                {formatRupees(line.price * line.quantity)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Discount Options */}
                      <div className="p-2.5 border border-rule bg-paper-subtle rounded-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wider font-bold text-ink">
                            Discount
                          </span>
                          {discountPaise > 0 && (
                            <span className="text-xs font-bold text-chilli">
                              -{formatRupees(discountPaise)}
                            </span>
                          )}
                        </div>

                        {/* Quick Discount Percent & None Buttons */}
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setDiscountType('none'); setDiscountValue(0); }}
                            className={`min-h-[36px] px-2 text-xs font-semibold rounded-sm border cursor-pointer ${
                              discountType === 'none'
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-white text-ink border-rule hover:bg-paper'
                            }`}
                          >
                            None
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDiscountType('percent'); setDiscountValue(5); }}
                            className={`min-h-[36px] px-2 text-xs font-semibold rounded-sm border cursor-pointer ${
                              discountType === 'percent' && discountValue === 5
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-white text-ink border-rule hover:bg-paper'
                            }`}
                          >
                            5%
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDiscountType('percent'); setDiscountValue(10); }}
                            className={`min-h-[36px] px-2 text-xs font-semibold rounded-sm border cursor-pointer ${
                              discountType === 'percent' && discountValue === 10
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-white text-ink border-rule hover:bg-paper'
                            }`}
                          >
                            10%
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDiscountType('percent'); setDiscountValue(15); }}
                            className={`min-h-[36px] px-2 text-xs font-semibold rounded-sm border cursor-pointer ${
                              discountType === 'percent' && discountValue === 15
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-white text-ink border-rule hover:bg-paper'
                            }`}
                          >
                            15%
                          </button>
                        </div>

                        {/* Flat Discount Shortcuts & Custom Amount */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setDiscountType('flat'); setDiscountValue(50); }}
                            className={`min-h-[36px] px-2.5 text-xs font-semibold rounded-sm border shrink-0 cursor-pointer ${
                              discountType === 'flat' && discountValue === 50
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-white text-ink border-rule hover:bg-paper'
                            }`}
                          >
                            ₹50 OFF
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDiscountType('flat'); setDiscountValue(100); }}
                            className={`min-h-[36px] px-2.5 text-xs font-semibold rounded-sm border shrink-0 cursor-pointer ${
                              discountType === 'flat' && discountValue === 100
                                ? 'bg-ink text-paper border-ink'
                                : 'bg-white text-ink border-rule hover:bg-paper'
                            }`}
                          >
                            ₹100 OFF
                          </button>
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-muted">₹</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="Custom ₹"
                              value={discountType === 'flat' && ![50, 100].includes(discountValue) && discountValue > 0 ? discountValue : ''}
                              onChange={e => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                if (val > 0) {
                                  setDiscountType('flat');
                                  setDiscountValue(val);
                                } else {
                                  setDiscountType('none');
                                  setDiscountValue(0);
                                }
                              }}
                              className="w-full pl-6 pr-2 py-1.5 text-xs border border-rule rounded-sm bg-white text-ink font-semibold focus:outline-none focus:border-ink"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Subtotal, Tax with GSTIN, Grand Total */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-ink-muted">Subtotal:</span>
                          <span className="font-bold tabular-nums">
                            {formatRupees(previewSubtotal)}
                          </span>
                        </div>

                        {discountPaise > 0 && (
                          <div className="flex justify-between text-xs text-chilli font-semibold">
                            <span>
                              Discount {discountType === 'percent' ? `(${discountValue}%)` : ''}:
                            </span>
                            <span className="tabular-nums font-bold">
                              -{formatRupees(discountPaise)}
                            </span>
                          </div>
                        )}

                        {previewTaxPercent > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-ink-muted">
                              {previewTaxPercent}% GST
                              {settings.gstin ? (
                                <span className="text-[10px] text-ink-muted ml-1">
                                  (GSTIN: {settings.gstin})
                                </span>
                              ) : null}:
                            </span>
                            <span className="font-bold tabular-nums">
                              {formatRupees(previewTaxAmount)}
                            </span>
                          </div>
                        )}

                        <div className="border-t border-ink pt-2 flex justify-between text-base font-black">
                          <span>Grand Total:</span>
                          <span className="tabular-nums text-ink">
                            {formatRupees(previewGrandTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Payment Method Selector (Min 48px tap targets) */}
                      <div>
                        <span className="block text-[11px] uppercase tracking-wider font-bold text-ink-muted mb-1.5">
                          Select Payment Method
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {(['upi', 'cash', 'card'] as const).map(mode => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setPaymentMethod(mode)}
                              className={`min-h-[48px] text-xs font-bold uppercase rounded-sm border cursor-pointer transition-colors ${
                                paymentMethod === mode
                                  ? 'bg-ink text-paper border-ink'
                                  : 'border-rule bg-paper-subtle text-ink hover:bg-paper'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* "Mark paid" Action Button */}
                      <button
                        type="button"
                        disabled={markingPaid || previewGroupedLines.length === 0}
                        onClick={handleMarkPaid}
                        className="w-full min-h-[52px] bg-chilli hover:bg-chilli-hover text-white text-sm font-black uppercase tracking-wider rounded-sm cursor-pointer transition-colors shadow-none flex items-center justify-center gap-2"
                      >
                        {markingPaid ? 'Processing...' : 'Mark paid & Print Receipt'}
                      </button>
                    </div>
                  )}

                  {/* Waiter Add Items Subview (Direct order, skips approval) */}
                  {isAddingItems && !isBillingPreview && (
                    <div className="p-3.5 border border-ink bg-white rounded-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-bold text-ink">
                          Place Order for Customer (Skips Approval)
                        </span>
                        <span className="text-[11px] text-ink-muted">
                          Sent straight to kitchen
                        </span>
                      </div>

                      {/* Category Navigation Tabs */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                        <button
                          type="button"
                          onClick={() => setActiveCategoryTab('all')}
                          className={`min-h-[38px] px-2.5 py-1 text-xs rounded-sm shrink-0 font-medium ${
                            activeCategoryTab === 'all'
                              ? 'bg-ink text-paper'
                              : 'border border-rule bg-paper-subtle text-ink'
                          }`}
                        >
                          All Items
                        </button>
                        {combos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveCategoryTab('combos')}
                            className={`min-h-[38px] px-2.5 py-1 text-xs rounded-sm shrink-0 font-medium ${
                              activeCategoryTab === 'combos'
                                ? 'bg-ink text-paper'
                                : 'border border-rule bg-paper-subtle text-ink'
                            }`}
                          >
                            Combos
                          </button>
                        )}
                        {categories.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategoryTab(cat.id)}
                            className={`min-h-[38px] px-2.5 py-1 text-xs rounded-sm shrink-0 font-medium ${
                              activeCategoryTab === cat.id
                                ? 'bg-ink text-paper'
                                : 'border border-rule bg-paper-subtle text-ink'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>

                      {/* Search Bar for Fast Waiter Lookup */}
                      <div className="relative">
                        <input
                          type="text"
                          value={itemSearch}
                          onChange={e => setItemSearch(e.target.value)}
                          placeholder="Search items (dosa, biryani, coffee, roast)..."
                          className="w-full px-3 py-2 text-xs border border-rule rounded-sm bg-paper-subtle text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink"
                        />
                        {itemSearch && (
                          <button
                            type="button"
                            onClick={() => setItemSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Menu Items Picker (Min 48px tap targets) */}
                      <div className="max-h-72 overflow-y-auto divide-y divide-rule/40 border border-rule p-2 rounded-sm space-y-1">
                        {combos.length === 0 && menuItems.length === 0 ? (
                          <div className="py-6 text-center text-xs text-ink-muted space-y-2">
                            <p>No menu items loaded.</p>
                            <button
                              type="button"
                              onClick={() => fetchMenu()}
                              className="px-3 py-1.5 border border-ink text-xs font-semibold rounded-sm bg-white hover:bg-paper-subtle cursor-pointer"
                            >
                              Reload Menu
                            </button>
                          </div>
                        ) : null}

                        {(activeCategoryTab === 'all' || activeCategoryTab === 'combos') &&
                          combos
                            .filter(c => !itemSearch || c.name.toLowerCase().includes(itemSearch.toLowerCase()))
                            .map(combo => {
                            const isAvailable = combo.is_available !== false;
                            const cartEntry = orderCart.find(ci => ci.id === combo.id && ci.type === 'combo');
                            const pricePaise = combo.price ?? combo.price_paise ?? 0;
                            return (
                              <div
                                key={combo.id}
                                className={`min-h-[48px] py-2 flex items-center justify-between text-xs ${
                                  !isAvailable ? 'opacity-60 bg-paper-subtle/50' : ''
                                }`}
                              >
                                <div className="flex items-center gap-1.5 pr-2">
                                  <DietaryBadge type={combo.dietary || (combo.is_veg ? 'veg' : 'non_veg')} size="sm" />
                                  <span className={`font-semibold text-ink ${!isAvailable ? 'line-through text-ink-muted' : ''}`}>
                                    {combo.name}
                                  </span>
                                  <span className="text-ink-muted tabular-nums">
                                    ({formatRupees(pricePaise)})
                                  </span>
                                  {!isAvailable && (
                                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-900 border border-red-300 rounded-sm">
                                      Sold Out
                                    </span>
                                  )}
                                </div>

                                <div className="shrink-0">
                                  {!isAvailable ? (
                                    <span className="min-h-[38px] px-2.5 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider border border-rule text-ink-muted bg-paper-subtle rounded-sm select-none">
                                      Unavailable
                                    </span>
                                  ) : cartEntry ? (
                                    <div className="flex items-center border border-ink/40 rounded-sm bg-paper-subtle h-8">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveFromCart(combo.id, 'combo')}
                                        className="w-8 h-full flex items-center justify-center font-bold text-sm cursor-pointer"
                                        aria-label="Decrease quantity"
                                      >
                                        -
                                      </button>
                                      <span className="w-6 text-center font-bold tabular-nums">
                                        {cartEntry.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleAddComboToCart(combo)}
                                        className="w-8 h-full flex items-center justify-center font-bold text-sm cursor-pointer"
                                        aria-label="Increase quantity"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAddComboToCart(combo)}
                                      className="min-h-[40px] px-3 border border-ink text-xs font-bold rounded-sm bg-white hover:bg-paper-subtle uppercase cursor-pointer"
                                    >
                                      + Add
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                        {menuItems
                          .filter(i => (activeCategoryTab === 'all' || i.category_id === activeCategoryTab) && (!itemSearch || i.name.toLowerCase().includes(itemSearch.toLowerCase())))
                          .map(item => {
                            const isAvailable = item.is_available !== false;
                            const cartEntry = orderCart.find(ci => ci.id === item.id && ci.type === 'item');
                            const pricePaise = item.price ?? item.price_paise ?? 0;
                            return (
                              <div
                                key={item.id}
                                className={`min-h-[48px] py-2 flex items-center justify-between text-xs ${
                                  !isAvailable ? 'opacity-60 bg-paper-subtle/50' : ''
                                }`}
                              >
                                <div className="flex items-center gap-1.5 pr-2">
                                  <DietaryBadge type={item.dietary || (item.is_veg ? 'veg' : 'non_veg')} size="sm" />
                                  <span className={`font-semibold text-ink ${!isAvailable ? 'line-through text-ink-muted' : ''}`}>
                                    {item.name}
                                  </span>
                                  <span className="text-ink-muted tabular-nums">
                                    ({formatRupees(pricePaise)})
                                  </span>
                                  {!isAvailable && (
                                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-900 border border-red-300 rounded-sm">
                                      Sold Out
                                    </span>
                                  )}
                                </div>

                                <div className="shrink-0">
                                  {!isAvailable ? (
                                    <span className="min-h-[38px] px-2.5 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider border border-rule text-ink-muted bg-paper-subtle rounded-sm select-none">
                                      Unavailable
                                    </span>
                                  ) : cartEntry ? (
                                    <div className="flex items-center border border-ink/40 rounded-sm bg-paper-subtle h-8">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveFromCart(item.id, 'item')}
                                        className="w-8 h-full flex items-center justify-center font-bold text-sm cursor-pointer"
                                        aria-label="Decrease quantity"
                                      >
                                        -
                                      </button>
                                      <span className="w-6 text-center font-bold tabular-nums">
                                        {cartEntry.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleAddItemToCart(item)}
                                        className="w-8 h-full flex items-center justify-center font-bold text-sm cursor-pointer"
                                        aria-label="Increase quantity"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAddItemToCart(item)}
                                      className="min-h-[40px] px-3 border border-ink text-xs font-bold rounded-sm bg-white hover:bg-paper-subtle uppercase cursor-pointer"
                                    >
                                      + Add
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {orderCart.length > 0 && (
                        <div className="space-y-2.5 pt-2 border-t border-rule">
                          <div className="flex justify-between text-xs font-bold">
                            <span>
                              Items: {orderCart.reduce((s, c) => s + c.quantity, 0)}
                            </span>
                            <span>
                              Total:{' '}
                              {formatRupees(
                                orderCart.reduce((s, c) => s + c.price * c.quantity, 0)
                              )}
                            </span>
                          </div>

                          <input
                            type="text"
                            value={orderNotes}
                            onChange={e => setOrderNotes(e.target.value)}
                            placeholder="Optional note for kitchen (e.g. less spicy, urgent)"
                            className="w-full text-xs px-3 py-2 border border-rule rounded-sm focus:outline-none focus:border-chilli"
                          />

                          <button
                            type="button"
                            disabled={submittingOrder}
                            onClick={handleSubmitWaiterOrder}
                            className="w-full min-h-[48px] bg-chilli text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-chilli-hover cursor-pointer"
                          >
                            {submittingOrder ? 'Sending to kitchen...' : 'Send Direct to Kitchen &rarr;'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active Orders List on this Table */}
                  {!isBillingPreview && (
                    <div className="space-y-3">
                      <span className="block text-xs uppercase tracking-wider font-bold text-ink-muted">
                        Table Orders ({selectedTable.orders.length})
                      </span>

                      {selectedTable.orders.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-rule rounded-sm text-xs text-ink-muted">
                          No orders placed on this table yet.
                        </div>
                      ) : (
                        selectedTable.orders.map(order => {
                          const isPending = order.status === 'pending';
                          const isReady = order.status === 'ready';
                          const isPreparing = order.status === 'preparing';
                          const orderLines = order.order_lines || order.items || [];
                          const orderTotal = (order.total_paise || 0) > 0
                            ? order.total_paise || 0
                            : orderLines.reduce(
                                (sum, l) => sum + (l.price_snapshot || l.price_paise || 0) * l.quantity,
                                0
                              );

                          return (
                            <div
                              key={order.id}
                              className={`p-3.5 border rounded-sm ${
                                isPending
                                  ? 'border-chilli bg-chilli-light/40 ring-1 ring-chilli'
                                  : 'border-rule bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-serif font-bold text-sm text-ink">
                                  Order {order.order_number ? `#${order.order_number}` : order.id.slice(-4).toUpperCase()}
                                  <span className="ml-2 text-[10px] uppercase font-normal text-ink-muted">
                                    ({order.source === 'customer' ? 'Customer' : 'Waiter'})
                                  </span>
                                </span>
                                <span className="text-[11px] text-ink-muted">
                                  {formatTimeAgo(order.created_at)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between mt-1 text-xs">
                                <span
                                  className={`font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded-sm border ${
                                    isPending
                                      ? 'bg-chilli text-white border-chilli animate-pulse'
                                      : order.status === 'approved'
                                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                                      : order.status === 'preparing'
                                      ? 'bg-orange-100 text-orange-900 border-orange-300'
                                      : order.status === 'ready'
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                                      : 'bg-stone-100 text-stone-700 border-stone-300'
                                  }`}
                                >
                                  {order.status}
                                </span>

                                <span className="font-bold tabular-nums">
                                  {formatRupees(orderTotal)}
                                </span>
                              </div>

                              {/* Order Items */}
                              <div className="mt-2.5 pt-2 border-t border-ink/10 space-y-1">
                                {orderLines.map((line, idx) => {
                                  const name = line.name_snapshot || line.item_name || 'Item';
                                  const price = line.price_snapshot || line.price_paise || 0;
                                  const note = line.note || line.notes;

                                  return (
                                    <div key={line.id || idx} className="flex justify-between items-baseline text-xs">
                                      <span>
                                        <span className="font-bold">{line.quantity}&times;</span> {name}
                                        {note ? <span className="text-ink-muted italic ml-1">({note})</span> : null}
                                      </span>
                                      <span className="text-ink-muted tabular-nums">
                                        {formatRupees(price * line.quantity)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {order.notes && (
                                <p className="text-[11px] italic text-ink-muted mt-2 border-t border-ink/5 pt-1">
                                  Table note: {order.notes}
                                </p>
                              )}

                              {/* Action Row for Pending Customer Orders */}
                              {isPending && (
                                <div className="mt-3 pt-2.5 border-t border-ink/15 space-y-2">
                                  <p className="text-[11px] font-bold text-chilli uppercase tracking-wider">
                                    Customer order awaiting approval:
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateOrderStatus(order.id, 'approved')}
                                      className="min-h-[48px] bg-chilli text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-chilli-hover cursor-pointer"
                                    >
                                      Approve &rarr; Kitchen
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setRejectingOrderId(order.id)}
                                      className="min-h-[48px] border border-chilli text-chilli bg-white hover:bg-chilli-light text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Action to Mark Served */}
                              {(isReady || isPreparing || order.status === 'approved') && (
                                <div className="mt-3 pt-2 border-t border-ink/10">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateOrderStatus(order.id, 'served')}
                                    className="w-full min-h-[48px] bg-stone-800 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer"
                                  >
                                    Mark served
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Desktop Split View: Empty state when no table is selected (lg: and above) */
        <aside className="hidden lg:flex lg:w-[460px] xl:w-[500px] 2xl:w-[540px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-0 lg:shrink-0 border-l border-rule bg-paper flex-col justify-center items-center text-center p-8 space-y-3 print:hidden">
          <div className="w-10 h-10 border border-rule flex items-center justify-center text-ink-muted text-xs font-serif uppercase tracking-widest font-bold">
            POS
          </div>
          <h3 className="font-serif text-base font-bold text-ink">
            Select a table
          </h3>
          <p className="text-xs text-ink-muted max-w-xs">
            Tap any table on the floor to view orders, add items, or generate a bill.
          </p>
        </aside>
      )}
    </div>

      {/* Past Bills Drawer (with Reprint & Corrections) */}
      {isPastBillsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/60 print:hidden">
          <div className="w-full max-w-md bg-paper border-l border-rule h-full flex flex-col shadow-none">
            <div className="p-4 border-b border-rule bg-paper-subtle flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">
                  Past Bills
                </h2>
                <p className="text-xs text-ink-muted">
                  Reprint thermal receipts & manage corrections
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPastBillsOpen(false)}
                className="w-10 h-10 flex items-center justify-center border border-rule rounded-sm text-sm text-ink hover:bg-paper cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {loadingBills ? (
                <p className="text-center py-12 text-xs text-ink-muted animate-pulse">Loading bills...</p>
              ) : pastBills.length === 0 ? (
                <p className="text-center py-12 text-xs text-ink-muted">No settled bills recorded today.</p>
              ) : (
                pastBills.map(b => {
                  const billTotal = b.final_paise ?? b.total ?? 0;
                  const isCancelled = Boolean(b.is_cancelled);

                  return (
                    <div
                      key={b.id}
                      className={`p-3.5 border rounded-sm bg-white space-y-2 ${
                        isCancelled ? 'border-dashed border-red-300 opacity-75' : 'border-rule'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-ink">
                              Bill #{b.bill_no || b.bill_number}
                            </span>
                            <span className="text-xs text-ink-muted">
                              &middot; {b.table?.table_number || 'Table'}
                            </span>
                          </div>
                          <span className="text-[11px] text-ink-muted block mt-0.5">
                            {formatDateShort(b.paid_at || b.created_at)} at {formatTimeOnly(b.paid_at || b.created_at)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-sm text-ink tabular-nums block">
                            {formatRupees(billTotal)}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                            {b.payment_method}
                          </span>
                        </div>
                      </div>

                      {isCancelled && (
                        <div className="p-1.5 bg-red-50 border border-red-200 text-red-800 text-[11px] rounded-sm">
                          <span className="font-bold uppercase">Cancelled:</span> {b.cancellation_reason || 'Correction'}
                        </div>
                      )}

                      <div className="pt-2 border-t border-ink/10 flex items-center gap-2">
                        {/* Reprint Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBill(b);
                          }}
                          className="min-h-[40px] flex-1 px-3 bg-ink text-paper text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-black cursor-pointer"
                        >
                          Reprint Bill
                        </button>

                        {/* Cancel Bill / Correction Button */}
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => setCancellingBillId(b.id)}
                            className="min-h-[40px] px-3 border border-rule text-xs font-bold uppercase tracking-wider rounded-sm text-ink-muted hover:border-chilli hover:text-chilli cursor-pointer"
                            title="Cancel bill for corrections (cannot edit paid bills)"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              <div className="p-3 bg-paper-card border border-rule text-[11px] text-ink-muted rounded-sm">
                <span className="font-bold uppercase text-ink block mb-0.5">Auditing Policy:</span>
                Paid bills are immutable and cannot be edited. Corrections require cancelling the bill with a recorded reason, followed by generating a new bill.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Bill Prompt Modal */}
      {cancellingBillId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
          <div className="bg-white border border-rule p-5 rounded-sm w-full max-w-sm space-y-3">
            <h3 className="font-serif text-base font-bold text-ink">
              Cancel Bill for Correction
            </h3>
            <p className="text-xs text-ink-muted">
              Paid bills cannot be edited. Please provide a reason to cancel this bill and record your audit trail:
            </p>

            <input
              type="text"
              value={cancelBillReason}
              onChange={e => setCancelBillReason(e.target.value)}
              placeholder="e.g. Wrong table selected, customer item change"
              className="w-full text-xs px-3 py-2 border border-rule rounded-sm focus:outline-none focus:border-chilli"
            />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingBillId(null);
                  setCancelBillReason('');
                }}
                className="min-h-[44px] border border-rule text-xs font-semibold rounded-sm text-ink-muted uppercase cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => handleCancelBill(cancellingBillId)}
                className="min-h-[44px] bg-chilli text-white text-xs font-bold uppercase rounded-sm hover:bg-chilli-hover cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Quick Reason Modal */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
          <div className="bg-white border border-rule p-5 rounded-sm w-full max-w-sm space-y-3">
            <h3 className="font-serif text-base font-bold text-ink">
              Reject Customer Order
            </h3>
            <p className="text-xs text-ink-muted">
              Select a reason to record on the order cancellation:
            </p>

            <div className="space-y-1.5">
              {[
                'Item out of stock',
                'Kitchen at capacity / high wait time',
                'Customer requested cancellation',
                'Duplicate order',
                'Other reason',
              ].map(reason => (
                <label
                  key={reason}
                  className={`flex items-center gap-2 p-2 border rounded-sm text-xs cursor-pointer ${
                    rejectionReason === reason ? 'border-chilli bg-chilli-light/30' : 'border-rule'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejectionReason"
                    checked={rejectionReason === reason}
                    onChange={() => setRejectionReason(reason)}
                    className="accent-chilli"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {rejectionReason === 'Other reason' && (
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Enter quick reason..."
                className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm focus:outline-none focus:border-chilli"
              />
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingOrderId(null)}
                className="min-h-[48px] border border-rule text-xs font-semibold rounded-sm text-ink-muted uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason = rejectionReason === 'Other reason' ? (customReason || 'Rejected by staff') : rejectionReason;
                  handleUpdateOrderStatus(rejectingOrderId, 'cancelled', finalReason);
                }}
                className="min-h-[48px] bg-chilli text-white text-xs font-bold uppercase rounded-sm hover:bg-chilli-hover"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      {activeBill && (
        <ThermalReceipt
          bill={activeBill}
          autoPrint={true}
          onClose={() => setActiveBill(null)}
        />
      )}
    </div>
  );
}
