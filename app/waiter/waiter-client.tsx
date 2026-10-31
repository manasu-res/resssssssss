'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RestaurantTable, Order, MenuItem, MenuCategory, Bill } from '@/lib/types';
import { formatRupees, formatTimeAgo } from '@/lib/format';
import { DietaryBadge } from '@/components/ui/dietary-badge';
import { ThermalReceipt } from '@/components/billing/thermal-receipt';
import type { StaffAuthResult } from '@/lib/auth/guard';

interface TableWithActiveOrders extends RestaurantTable {
  activeOrders: Order[];
  pendingOrdersCount: number;
  currentTotalPaise: number;
}

interface WaiterClientProps {
  staff: StaffAuthResult;
}

export default function WaiterClient({ staff: currentStaff }: WaiterClientProps) {
  const router = useRouter();
  const [tables, setTables] = useState<TableWithActiveOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableWithActiveOrders | null>(null);

  // Menu data for taking verbal orders directly
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Waiter add-order state
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [orderCart, setOrderCart] = useState<Array<{ item: MenuItem; quantity: number }>>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Settlement & Thermal Receipt state
  const [isSettling, setIsSettling] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [discountRupees, setDiscountRupees] = useState('');
  const [settlingBill, setSettlingBill] = useState(false);
  const [activeBill, setActiveBill] = useState<Bill | null>(null);

  // Filter
  const [tableFilter, setTableFilter] = useState<'all' | 'occupied' | 'pending' | 'vacant'>('all');

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/waiter/tables');
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setTables(data.tables || []);

      if (selectedTable) {
        const updated = (data.tables || []).find((t: TableWithActiveOrders) => t.id === selectedTable.id);
        if (updated) setSelectedTable(updated);
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  }, [router, selectedTable]);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/menu');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setMenuItems(data.items || []);
        if (data.categories?.length > 0) {
          setActiveCategory(data.categories[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    fetchMenu();
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, [fetchTables, fetchMenu]);

  // Order approval
  const handleApproveOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/waiter/order/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'approved' }),
      });
      if (res.ok) {
        fetchTables();
      }
    } catch (err) {
      console.error('Error approving order:', err);
    }
  };

  // Waiter direct order
  const handleAddToOrderCart = (item: MenuItem) => {
    setOrderCart(prev => {
      const exist = prev.find(i => i.item.id === item.id);
      if (exist) {
        return prev.map(i => (i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleRemoveFromOrderCart = (itemId: string) => {
    setOrderCart(prev => {
      const exist = prev.find(i => i.item.id === itemId);
      if (!exist) return prev;
      if (exist.quantity <= 1) return prev.filter(i => i.item.id !== itemId);
      return prev.map(i => (i.item.id === itemId ? { ...i, quantity: i.quantity - 1 } : i));
    });
  };

  const handleSubmitWaiterOrder = async () => {
    if (!selectedTable || orderCart.length === 0 || submittingOrder) return;
    setSubmittingOrder(true);
    try {
      const res = await fetch('/api/waiter/order/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          notes: orderNotes.trim(),
          items: orderCart.map(i => ({
            itemId: i.item.id,
            quantity: i.quantity,
          })),
        }),
      });

      if (res.ok) {
        setOrderCart([]);
        setOrderNotes('');
        setIsAddingItems(false);
        fetchTables();
      }
    } catch (err) {
      console.error('Error submitting waiter order:', err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Settle Bill
  const handleSettleBill = async () => {
    if (!selectedTable || settlingBill) return;
    setSettlingBill(true);
    try {
      const discountPaise = Math.round((parseFloat(discountRupees) || 0) * 100);
      const res = await fetch('/api/waiter/bill/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          paymentMethod,
          discountPaise,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsSettling(false);
        setDiscountRupees('');
        setActiveBill(data.bill);
        fetchTables();
      } else {
        alert(data.error || 'Failed to settle bill');
      }
    } catch (err) {
      console.error('Error settling bill:', err);
    } finally {
      setSettlingBill(false);
    }
  };

  // Vacate Table
  const handleVacateTable = async () => {
    if (!selectedTable) return;
    if (!confirm(`Vacate ${selectedTable.table_number}? This frees the table for the next customer.`)) {
      return;
    }
    try {
      const res = await fetch('/api/waiter/table/vacate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: selectedTable.id, resetToken: true }),
      });
      if (res.ok) {
        setSelectedTable(null);
        fetchTables();
      }
    } catch (err) {
      console.error('Error vacating table:', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const filteredTables = tables.filter(t => {
    if (tableFilter === 'occupied') return t.status === 'occupied';
    if (tableFilter === 'vacant') return t.status === 'vacant';
    if (tableFilter === 'pending') return t.pendingOrdersCount > 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      {/* Top POS App Bar */}
      <header className="h-14 bg-ink text-paper px-4 flex items-center justify-between border-b border-black shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-serif text-lg font-bold tracking-tight">MANASU</span>
          <span className="text-[11px] uppercase tracking-widest bg-paper/20 px-2 py-0.5 rounded-sm">
            Floor POS
          </span>
          <span className="text-[11px] text-paper/70 hidden sm:inline">
            &bull; {currentStaff.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentStaff.role === 'owner' && (
            <a
              href="/admin"
              className="h-9 px-3 border border-paper/30 hover:border-paper text-xs rounded-sm flex items-center justify-center font-medium transition-colors"
            >
              Admin &rarr;
            </a>
          )}
          <a
            href="/kitchen"
            className="h-9 px-3 border border-paper/30 hover:border-paper text-xs rounded-sm flex items-center justify-center font-medium transition-colors"
          >
            Kitchen Screen &rarr;
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="h-9 px-2.5 border border-paper/30 hover:bg-paper/10 text-xs rounded-sm transition-colors text-paper/80"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="px-4 py-2.5 bg-paper-subtle border-b border-rule flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-xs uppercase tracking-wider text-ink-muted font-bold shrink-0">
          Tables:
        </span>
        <button
          type="button"
          onClick={() => setTableFilter('all')}
          className={`h-9 px-3 text-xs font-semibold rounded-sm shrink-0 ${
            tableFilter === 'all' ? 'bg-ink text-paper' : 'border border-rule bg-white text-ink'
          }`}
        >
          All ({tables.length})
        </button>
        <button
          type="button"
          onClick={() => setTableFilter('occupied')}
          className={`h-9 px-3 text-xs font-semibold rounded-sm shrink-0 ${
            tableFilter === 'occupied' ? 'bg-ink text-paper' : 'border border-rule bg-white text-ink'
          }`}
        >
          Occupied ({tables.filter(t => t.status === 'occupied').length})
        </button>
        <button
          type="button"
          onClick={() => setTableFilter('pending')}
          className={`h-9 px-3 text-xs font-semibold rounded-sm shrink-0 flex items-center gap-1.5 ${
            tableFilter === 'pending'
              ? 'bg-chilli text-white'
              : 'border border-chilli bg-chilli-light text-chilli'
          }`}
        >
          <span>Pending Approvals</span>
          <span className="px-1.5 py-0.2 bg-white text-chilli rounded-sm font-bold text-[10px]">
            {tables.reduce((sum, t) => sum + t.pendingOrdersCount, 0)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTableFilter('vacant')}
          className={`h-9 px-3 text-xs font-semibold rounded-sm shrink-0 ${
            tableFilter === 'vacant' ? 'bg-ink text-paper' : 'border border-rule bg-white text-ink'
          }`}
        >
          Vacant ({tables.filter(t => t.status === 'vacant').length})
        </button>
      </div>

      {/* Main Grid Area */}
      <main className="p-4 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center py-12 text-sm text-ink-muted">Loading table layout...</p>
        ) : filteredTables.length === 0 ? (
          <p className="text-center py-12 text-sm text-ink-muted">No tables match this filter.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredTables.map(t => {
              const isOccupied = t.status === 'occupied';
              const isBilled = t.status === 'billed';
              const hasPending = t.pendingOrdersCount > 0;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTable(t)}
                  className={`min-h-[110px] p-3 text-left border rounded-sm flex flex-col justify-between transition-all active:scale-[0.98] ${
                    hasPending
                      ? 'border-chilli bg-chilli-light/40 ring-1 ring-chilli'
                      : isOccupied
                      ? 'border-amber-400 bg-amber-50/60'
                      : isBilled
                      ? 'border-blue-400 bg-blue-50/60'
                      : 'border-rule bg-white hover:bg-paper-subtle'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-serif text-base font-bold text-ink leading-tight block">
                        {t.table_number}
                      </span>
                      <span className="text-[10px] text-ink-muted uppercase tracking-wider">
                        {t.seat_capacity} Seats
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                        hasPending
                          ? 'bg-chilli text-white animate-pulse'
                          : isOccupied
                          ? 'bg-amber-800 text-amber-50'
                          : isBilled
                          ? 'bg-blue-800 text-blue-50'
                          : 'bg-green-800 text-green-50'
                      }`}
                    >
                      {hasPending ? 'Action' : t.status}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-ink/10 flex items-baseline justify-between">
                    <span className="text-xs font-bold tabular-nums text-ink">
                      {formatRupees(t.currentTotalPaise)}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      {t.activeOrders.length} {t.activeOrders.length === 1 ? 'order' : 'orders'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Selected Table Drawer */}
      {selectedTable && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/60">
          <div className="w-full max-w-md bg-paper border-l border-rule h-full flex flex-col">
            <div className="p-4 border-b border-rule bg-paper-subtle flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-bold text-ink">
                    {selectedTable.table_number}
                  </h2>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${
                      selectedTable.status === 'occupied'
                        ? 'bg-amber-800 text-white'
                        : selectedTable.status === 'billed'
                        ? 'bg-blue-800 text-white'
                        : 'bg-green-800 text-white'
                    }`}
                  >
                    {selectedTable.status}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  QR Token: <code className="font-mono text-ink">{selectedTable.active_token}</code>
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTable(null);
                  setIsAddingItems(false);
                  setIsSettling(false);
                }}
                className="w-9 h-9 flex items-center justify-center border border-rule rounded-sm text-sm text-ink hover:bg-paper"
              >
                &times;
              </button>
            </div>

            <div className="px-4 py-2.5 border-b border-rule bg-paper flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAddingItems(!isAddingItems);
                  setIsSettling(false);
                }}
                className="h-10 flex-1 px-3 bg-white border border-ink text-ink text-xs font-bold rounded-sm uppercase tracking-wider hover:bg-paper-subtle"
              >
                {isAddingItems ? 'Hide Menu' : '+ Add Items'}
              </button>

              {selectedTable.activeOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSettling(!isSettling);
                    setIsAddingItems(false);
                  }}
                  className="h-10 flex-1 px-3 bg-ink text-paper text-xs font-bold rounded-sm uppercase tracking-wider hover:bg-black"
                >
                  {isSettling ? 'Back' : 'Bill & Pay'}
                </button>
              )}

              <button
                type="button"
                onClick={handleVacateTable}
                className="h-10 px-3 border border-rule hover:border-chilli hover:text-chilli text-xs font-semibold rounded-sm text-ink-muted"
                title="Vacate and refresh QR for next party"
              >
                Vacate
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Waiter Add Items Section */}
              {isAddingItems && (
                <div className="p-3 border border-ink/40 bg-white rounded-sm space-y-3">
                  <span className="block text-xs uppercase tracking-wider font-bold text-ink">
                    Take Verbal Order at Table
                  </span>

                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-2 py-1 text-xs rounded-sm shrink-0 ${
                          activeCategory === cat.id
                            ? 'bg-ink text-paper font-medium'
                            : 'border border-rule bg-paper-subtle text-ink'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-rule/40 border border-rule/60 p-2 rounded-sm">
                    {menuItems
                      .filter(i => !activeCategory || i.category_id === activeCategory)
                      .map(item => {
                        const inCart = orderCart.find(ci => ci.item.id === item.id)?.quantity || 0;
                        return (
                          <div key={item.id} className="py-1.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <DietaryBadge type={item.dietary} size="sm" />
                              <span className="font-medium text-ink">{item.name}</span>
                              <span className="text-ink-muted tabular-nums">
                                ({formatRupees(item.price_paise)})
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {inCart > 0 ? (
                                <div className="flex items-center border border-ink/30 rounded-sm">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFromOrderCart(item.id)}
                                    className="w-6 h-6 flex items-center justify-center font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="w-5 text-center font-bold">{inCart}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToOrderCart(item)}
                                    className="w-6 h-6 flex items-center justify-center font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddToOrderCart(item)}
                                  className="h-6 px-2 border border-ink/40 text-[11px] font-semibold rounded-sm hover:bg-paper-subtle"
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
                    <div className="space-y-2 pt-2 border-t border-rule">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Items to send: {orderCart.reduce((s, c) => s + c.quantity, 0)}</span>
                        <span>
                          Total:{' '}
                          {formatRupees(
                            orderCart.reduce((s, c) => s + c.item.price_paise * c.quantity, 0)
                          )}
                        </span>
                      </div>

                      <input
                        type="text"
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        placeholder="Order note (e.g. less salt)"
                        className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm"
                      />

                      <button
                        type="button"
                        disabled={submittingOrder}
                        onClick={handleSubmitWaiterOrder}
                        className="w-full h-10 bg-chilli text-white text-xs font-bold uppercase rounded-sm hover:bg-chilli-hover"
                      >
                        {submittingOrder ? 'Sending to kitchen...' : 'Send Direct to Kitchen'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Settlement View */}
              {isSettling && (
                <div className="p-4 border border-ink bg-white rounded-sm space-y-3">
                  <span className="block text-xs uppercase tracking-wider font-bold text-ink">
                    Settle Table Bill & Print Receipt
                  </span>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Subtotal:</span>
                      <span className="font-bold tabular-nums">
                        {formatRupees(selectedTable.currentTotalPaise)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">5% GST (2.5% CGST + 2.5% SGST):</span>
                      <span className="font-bold tabular-nums">
                        {formatRupees(Math.round(selectedTable.currentTotalPaise * 0.05))}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-ink-muted">Discount (₹):</span>
                      <input
                        type="number"
                        min="0"
                        value={discountRupees}
                        onChange={e => setDiscountRupees(e.target.value)}
                        placeholder="0"
                        className="w-20 text-right text-xs px-2 py-1 border border-rule rounded-sm font-mono"
                      />
                    </div>

                    <div className="border-t border-ink pt-2 flex justify-between text-sm font-bold">
                      <span>Final Amount:</span>
                      <span className="tabular-nums">
                        {formatRupees(
                          Math.max(
                            0,
                            selectedTable.currentTotalPaise +
                              Math.round(selectedTable.currentTotalPaise * 0.05) -
                              Math.round((parseFloat(discountRupees) || 0) * 100)
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1.5">
                      Payment Mode
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {(['upi', 'cash', 'card'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMethod(mode)}
                          className={`h-10 text-xs font-bold uppercase rounded-sm border ${
                            paymentMethod === mode
                              ? 'bg-ink text-paper border-ink'
                              : 'border-rule bg-paper-subtle text-ink'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={settlingBill}
                    onClick={handleSettleBill}
                    className="w-full h-11 bg-ink text-paper text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-black mt-2"
                  >
                    {settlingBill ? 'Processing...' : 'Collect Payment & Print Receipt'}
                  </button>
                </div>
              )}

              {/* Active Orders List on this table */}
              <div className="space-y-3">
                <span className="block text-xs uppercase tracking-wider font-bold text-ink-muted">
                  Active Table Orders ({selectedTable.activeOrders.length})
                </span>

                {selectedTable.activeOrders.length === 0 ? (
                  <p className="text-xs text-ink-muted py-6 text-center border border-dashed border-rule rounded-sm">
                    No orders placed yet for this table.
                  </p>
                ) : (
                  selectedTable.activeOrders.map(order => {
                    const isPending = order.status === 'pending';
                    return (
                      <div
                        key={order.id}
                        className={`p-3 border rounded-sm ${
                          isPending ? 'border-chilli bg-chilli-light/30' : 'border-rule bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-sm text-ink">
                            Order #{order.order_number}
                          </span>
                          <span className="text-[11px] text-ink-muted">
                            {formatTimeAgo(order.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span
                            className={`font-semibold uppercase tracking-wider text-[10px] ${
                              isPending ? 'text-chilli' : 'text-ink-muted'
                            }`}
                          >
                            Status: {order.status}
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatRupees(order.total_paise)}
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-ink/10 space-y-1">
                          {order.items?.map(it => (
                            <div key={it.id} className="flex justify-between text-xs">
                              <span>
                                {it.quantity}x {it.item_name}
                              </span>
                              <span className="tabular-nums text-ink-muted">
                                {formatRupees(it.price_paise * it.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {order.notes && (
                          <p className="text-[11px] italic text-ink-muted mt-2">
                            Note: {order.notes}
                          </p>
                        )}

                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleApproveOrder(order.id)}
                            className="w-full mt-3 h-11 bg-chilli text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-chilli-hover"
                          >
                            Approve Order & Send to Kitchen &rarr;
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      {activeBill && (
        <ThermalReceipt bill={activeBill} onClose={() => setActiveBill(null)} />
      )}
    </div>
  );
}
