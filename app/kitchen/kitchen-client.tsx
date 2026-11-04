'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffAuthResult } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/client';

export interface KitchenComboItem {
  name: string;
  quantity: number;
}

export interface KitchenOrderLine {
  id: string;
  name: string;
  quantity: number;
  note?: string;
  is_combo?: boolean;
  combo_items?: KitchenComboItem[];
}

export interface KitchenOrder {
  id: string;
  order_number: string;
  table_label: string;
  status: 'placed' | 'approved' | 'preparing' | 'ready';
  source?: string;
  created_at: string;
  approved_at?: string;
  notes?: string;
  lines: KitchenOrderLine[];
}

interface KitchenClientProps {
  staff: StaffAuthResult;
}

// Soft sound chime for kitchen environment (warm sine bell, offline, zero assets)
function playKitchenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle warm C5 tone (523.25 Hz) followed by E5 (659.25 Hz)
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch {
    // Ignore if audio context not permitted before first user gesture
  }
}

export default function KitchenClient({ staff: currentStaff }: KitchenClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [showReady, setShowReady] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Item 86\'d / out of stock');

  // Track previous order IDs to detect new tickets for soft sound
  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  // Preserve order status changes made in this session so polling never resets them
  const localKitchenStatusRef = useRef<Record<string, 'preparing' | 'ready'>>({});

  // Clock ticker every 10 seconds for real-time minute counters
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen/orders');
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      const rawOrders: KitchenOrder[] = data.orders || [];
      const loadedOrders = rawOrders.map(o => {
        const override = localKitchenStatusRef.current[o.id];
        return override ? { ...o, status: override } : o;
      });

      // Detect newly arrived placed or approved tickets for soft chime
      if (prevOrderIdsRef.current.size > 0) {
        const hasNewTicket = loadedOrders.some(
          o => !prevOrderIdsRef.current.has(o.id) && (o.status === 'placed' || o.status === 'approved')
        );
        if (hasNewTicket) {
          playKitchenChime();
        }
      }

      // Update ref set
      prevOrderIdsRef.current = new Set(loadedOrders.map(o => o.id));
      setOrders(loadedOrders);
    } catch (err) {
      console.error('Failed to fetch kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOrders();

    // 1. Supabase Realtime subscription on orders
    let channel: any = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel('kitchen-realtime-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
          if (payload.eventType === 'UPDATE' && (payload.new as any)?.status === 'approved') {
            playKitchenChime();
          }
          fetchOrders();
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription skipped or unavailable:', e);
    }

    // 2. High-reliability polling fallback every 3s
    const interval = setInterval(fetchOrders, 3000);

    return () => {
      clearInterval(interval);
      if (channel) {
        try {
          channel.unsubscribe();
        } catch {}
      }
    };
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId: string, status: 'preparing' | 'ready') => {
    localKitchenStatusRef.current[orderId] = status;
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status } : o)));
    setUpdatingId(orderId);
    try {
      const res = await fetch('/api/kitchen/order/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      if (res.ok) {
        await fetchOrders();
      }
    } catch (err) {
      console.error('Error updating kitchen order status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectingOrderId) return;
    try {
      const res = await fetch('/api/kitchen/order/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: rejectingOrderId, reason: rejectReason }),
      });
      if (res.ok) {
        setRejectingOrderId(null);
        await fetchOrders();
      }
    } catch (err) {
      console.error('Error rejecting kitchen order:', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Filter orders: By default show active tickets (placed, approved & preparing), oldest first.
  const activeTickets = orders.filter(o =>
    showReady ? true : o.status === 'placed' || o.status === 'approved' || o.status === 'preparing'
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none">
      {/* Minimal Top Header - No Clutter, Readable From 2m */}
      <header className="min-h-[64px] py-2 bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0 print:hidden">
        <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
          <span className="font-serif text-xl sm:text-2xl font-black tracking-tight text-white whitespace-nowrap">
            MANASU KITCHEN
          </span>
          <span className="text-[11px] sm:text-xs uppercase font-extrabold tracking-widest px-2.5 py-1 bg-amber-400 text-neutral-950 rounded-sm">
            LIVE KDS
          </span>
          <span className="text-xs sm:text-sm font-mono font-bold text-neutral-400 hidden md:inline">
            {activeTickets.length} ACTIVE TICKET{activeTickets.length === 1 ? '' : 'S'}
          </span>
        </div>

        {/* Minimal Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowReady(prev => !prev)}
            className={`min-h-[44px] px-3.5 text-xs font-bold uppercase tracking-wider rounded-sm border cursor-pointer transition-colors ${
              showReady
                ? 'bg-neutral-100 text-neutral-950 border-white'
                : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
            }`}
          >
            {showReady ? 'Hide Ready' : 'Show Ready'}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="min-h-[44px] px-3.5 text-xs font-bold uppercase tracking-wider rounded-sm border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white cursor-pointer"
            title="Toggle Fullscreen"
          >
            [ ] Fullscreen
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] px-3 text-xs font-bold uppercase tracking-wider rounded-sm border border-neutral-800 text-neutral-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Order Tickets Area: Oldest First */}
      <main className="p-6 flex-1 overflow-x-auto overflow-y-auto print:hidden">
        {loading ? (
          <div className="py-24 text-center">
            <p className="text-2xl font-bold text-neutral-400 animate-pulse font-mono">
              CONNECTING TO KITCHEN ORDER FEED...
            </p>
          </div>
        ) : activeTickets.length === 0 ? (
          <div className="py-28 text-center space-y-3">
            <h2 className="text-4xl font-black text-neutral-500 uppercase tracking-wide">
              All Orders Clear
            </h2>
            <p className="text-lg text-neutral-400 max-w-md mx-auto">
              Approved orders from floor staff will chime and appear here in real time.
            </p>
          </div>
        ) : (
          /* High-Contrast Multi-Column Ticket Board (oldest first) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 items-start">
            {activeTickets.map(order => {
              // Calculate elapsed waiting minutes
              const elapsedMinutes = Math.max(
                0,
                Math.floor((currentTime - new Date(order.created_at).getTime()) / 60000)
              );

              // Timing thresholds:
              // <10m: normal; >=10m: amber; >=20m: red (with number clearly visible)
              let timerBadge = {
                badgeClass: 'bg-neutral-800 text-neutral-200 border-neutral-700',
                borderClass: 'border-neutral-700',
              };

              if (elapsedMinutes >= 20) {
                timerBadge = {
                  badgeClass: 'bg-red-600 text-white font-black border-red-500 animate-pulse',
                  borderClass: 'border-red-500 ring-2 ring-red-500/50',
                };
              } else if (elapsedMinutes >= 10) {
                timerBadge = {
                  badgeClass: 'bg-amber-500 text-neutral-950 font-black border-amber-400',
                  borderClass: 'border-amber-500 ring-1 ring-amber-500/40',
                };
              }

              const isPreparing = order.status === 'preparing';
              const isReady = order.status === 'ready';

              return (
                <div
                  key={order.id}
                  className={`w-full bg-neutral-900 border-2 rounded-sm flex flex-col justify-between transition-all ${
                    isReady
                      ? 'border-emerald-500'
                      : isPreparing
                      ? 'border-amber-400'
                      : timerBadge.borderClass
                  }`}
                >
                  {/* Ticket Header: Large Table Label & Time Waiting */}
                  <div className="p-4 border-b border-neutral-800 bg-neutral-950 flex items-start justify-between gap-3">
                    <div>
                      {/* Big Table Label */}
                      <span className="font-serif text-3xl sm:text-4xl font-black text-white tracking-wide block leading-none">
                        {order.table_label.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-neutral-400 mt-1 flex items-center gap-2 uppercase font-bold tracking-wider">
                        <span>KOT #{order.order_number}</span>
                        {order.source === 'customer' ? (
                          <span className="bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                            Customer
                          </span>
                        ) : (
                          <span>&middot; {order.source || 'STAFF'}</span>
                        )}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      {/* Waiting Time: turns amber after 10m, red after 20m with visible number */}
                      <span
                        className={`inline-block text-base sm:text-lg font-mono font-black uppercase px-3 py-1 rounded-sm border ${timerBadge.badgeClass}`}
                        title="Elapsed order preparation time"
                      >
                        {elapsedMinutes} MIN
                      </span>
                      <span className="block text-[11px] uppercase font-bold tracking-wider text-neutral-400 mt-1">
                        {isReady ? 'READY' : isPreparing ? 'COOKING' : 'PLACED'}
                      </span>
                    </div>
                  </div>

                  {/* Order Lines: Large Type, Indented Combos, Highlighted Notes */}
                  <div className="p-4 space-y-4 flex-1">
                    <div className="divide-y divide-neutral-800/80">
                      {order.lines.map((line, idx) => (
                        <div key={line.id || idx} className="py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-start gap-3">
                            {/* Big Quantity */}
                            <span className="text-2xl font-black font-mono text-amber-400 shrink-0 leading-none">
                              {line.quantity}&times;
                            </span>

                            {/* Item / Combo Name (Large Type) */}
                            <div className="flex-1">
                              <span className="text-xl font-bold text-white leading-tight block">
                                {line.name}
                              </span>

                              {/* Combo Contents Indented Under Combo Name */}
                              {line.is_combo && line.combo_items && line.combo_items.length > 0 && (
                                <div className="mt-1 pl-3 border-l-2 border-neutral-700 space-y-1">
                                  {line.combo_items.map((ci, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="text-sm font-semibold text-neutral-300 leading-tight"
                                    >
                                      &bull; {ci.quantity * line.quantity}&times; {ci.name}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Item Note in a Highlighted Line */}
                              {line.note && (
                                <div className="mt-1.5 p-1.5 bg-amber-400/20 border-l-4 border-amber-400 rounded-r-sm">
                                  <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                                    NOTE:
                                  </span>{' '}
                                  <span className="text-sm font-bold text-amber-200">
                                    {line.note}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Table-Level Instructions in Highlighted Line */}
                    {order.notes && (
                      <div className="p-2.5 bg-amber-400/20 border-l-4 border-amber-400 rounded-r-sm space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-300 block">
                          TABLE INSTRUCTIONS:
                        </span>
                        <p className="text-sm font-bold text-amber-100">
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Per Ticket: "Start", "Ready", and "Reject" */}
                  <div className="p-3 bg-neutral-950 border-t border-neutral-800 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {order.status === 'placed' || order.status === 'approved' ? (
                        <>
                          {/* "Start" button marks order preparing */}
                          <button
                            type="button"
                            disabled={updatingId === order.id}
                            onClick={() => handleUpdateStatus(order.id, 'preparing')}
                            className="min-h-[48px] bg-amber-400 hover:bg-amber-300 text-neutral-950 text-sm font-black uppercase tracking-wider rounded-sm cursor-pointer transition-colors col-span-2 flex items-center justify-center"
                          >
                            {updatingId === order.id ? 'Starting...' : 'Start'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingOrderId(order.id)}
                            className="min-h-[48px] bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-colors flex items-center justify-center"
                          >
                            Reject
                          </button>
                        </>
                      ) : order.status === 'preparing' ? (
                        <>
                          {/* "Ready" button marks order ready (waiter screen updates live) */}
                          <button
                            type="button"
                            disabled={updatingId === order.id}
                            onClick={() => handleUpdateStatus(order.id, 'ready')}
                            className="min-h-[48px] bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-black uppercase tracking-wider rounded-sm cursor-pointer transition-colors col-span-2 flex items-center justify-center"
                          >
                            {updatingId === order.id ? 'Updating...' : 'Ready'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingOrderId(order.id)}
                            className="min-h-[48px] bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-colors flex items-center justify-center"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <div className="col-span-3 p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-center rounded-sm">
                          <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                            Ready for waiter
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Reject Order Reason Modal */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 p-6 rounded max-w-sm w-full space-y-4">
            <h3 className="font-serif text-lg font-bold text-white">Reject Order</h3>
            <p className="text-xs text-neutral-400">
              Select reason for rejecting this ticket. The waiter will be notified immediately.
            </p>
            <div className="space-y-2">
              {[
                "Item 86'd / out of stock",
                'Kitchen at capacity / excessive delay',
                'Kitchen closing',
                'Cannot prepare special instructions',
              ].map(r => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2 rounded border cursor-pointer text-xs ${
                    rejectReason === r ? 'border-amber-400 bg-amber-400/10 text-white font-bold' : 'border-neutral-800 text-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="kitchenRejectReason"
                    value={r}
                    checked={rejectReason === r}
                    onChange={() => setRejectReason(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingOrderId(null)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold uppercase rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectOrder}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded cursor-pointer"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
