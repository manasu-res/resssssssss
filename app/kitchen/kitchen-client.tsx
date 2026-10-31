'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Order, OrderStatus } from '@/lib/types';
import { formatTimeAgo } from '@/lib/format';
import { DietaryBadge } from '@/components/ui/dietary-badge';
import type { StaffAuthResult } from '@/lib/auth/guard';

interface KitchenClientProps {
  staff: StaffAuthResult;
}

export default function KitchenClient({ staff: currentStaff }: KitchenClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'preparing' | 'ready'>('all');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen/orders');
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Failed to fetch kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch('/api/kitchen/order/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text flex flex-col font-sans select-none">
      {/* KDS Top Bar - High Contrast */}
      <header className="h-16 bg-pos-panel border-b border-pos-border px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-serif text-2xl font-black tracking-tight text-white">
            MANASU KITCHEN
          </span>
          <span className="text-xs uppercase font-bold tracking-widest px-2.5 py-1 bg-amber-500 text-black rounded-sm">
            Live KDS
          </span>
          <span className="text-xs text-pos-muted hidden sm:inline">
            &bull; {currentStaff.name}
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          {(['all', 'approved', 'preparing', 'ready'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`h-10 px-3.5 text-xs font-bold uppercase rounded-sm border ${
                statusFilter === tab
                  ? 'bg-white text-black border-white'
                  : 'bg-pos-card text-pos-muted border-pos-border hover:text-white'
              }`}
            >
              {tab === 'all' ? `All (${orders.length})` : `${tab} (${orders.filter(o => o.status === tab).length})`}
            </button>
          ))}
          {currentStaff.role === 'owner' && (
            <a
              href="/admin"
              className="h-10 px-3 border border-pos-border text-pos-muted hover:text-white text-xs font-bold uppercase rounded-sm flex items-center ml-2"
            >
              Admin &rarr;
            </a>
          )}
          <a
            href="/waiter"
            className="h-10 px-3 border border-pos-border text-pos-muted hover:text-white text-xs font-bold uppercase rounded-sm flex items-center ml-1"
          >
            Floor &rarr;
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="h-10 px-3 border border-pos-border text-pos-muted hover:text-white text-xs font-bold uppercase rounded-sm ml-1"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main KDS Grid */}
      <main className="p-4 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center py-20 text-pos-muted text-lg animate-pulse">
            Connecting to live kitchen feed...
          </p>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-24 text-pos-muted space-y-2">
            <p className="text-2xl font-bold text-neutral-400">All orders clear</p>
            <p className="text-sm">New incoming orders from waiters or tables will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => {
              const tableName = order.table?.table_number || `Table #${order.table_id}`;
              const isUrgent =
                Date.now() - new Date(order.created_at).getTime() > 15 * 60000;

              return (
                <div
                  key={order.id}
                  className={`border-2 rounded-sm bg-pos-panel flex flex-col justify-between shadow-kds ${
                    order.status === 'ready'
                      ? 'border-green-500'
                      : order.status === 'preparing'
                      ? 'border-amber-500'
                      : 'border-pos-border'
                  }`}
                >
                  <div
                    className={`p-3 border-b border-pos-border flex items-center justify-between ${
                      order.status === 'ready'
                        ? 'bg-green-950/60'
                        : order.status === 'preparing'
                        ? 'bg-amber-950/60'
                        : 'bg-pos-card'
                    }`}
                  >
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-wide leading-none">
                        {tableName.toUpperCase()}
                      </h2>
                      <span className="text-xs text-pos-muted font-mono mt-0.5 block">
                        Order #{order.order_number} &middot; {order.source}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs font-black uppercase px-2 py-0.5 rounded-sm block ${
                          order.status === 'ready'
                            ? 'bg-green-500 text-black'
                            : order.status === 'preparing'
                            ? 'bg-amber-500 text-black'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold mt-1 block ${
                          isUrgent ? 'text-red-400 font-extrabold animate-pulse' : 'text-pos-muted'
                        }`}
                      >
                        {formatTimeAgo(order.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                    {order.items?.map(it => (
                      <div
                        key={it.id}
                        className="flex items-start justify-between border-b border-pos-border/40 pb-2.5 last:border-b-0"
                      >
                        <div className="flex items-start gap-2.5 flex-1 pr-2">
                          <span className="text-lg font-black text-amber-400 font-mono shrink-0">
                            {it.quantity}&times;
                          </span>
                          <div>
                            <span className="text-base font-bold text-white leading-tight block">
                              {it.item_name}
                            </span>
                            {it.notes ? (
                              <span className="text-xs bg-amber-400 text-black px-1.5 py-0.5 font-bold uppercase rounded-sm inline-block mt-1">
                                {it.notes}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <DietaryBadge type={it.dietary} size="md" />
                      </div>
                    ))}

                    {order.notes && (
                      <div className="mt-2 p-2 bg-amber-400/10 border border-amber-400/40 rounded-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                          Table Instructions:
                        </span>
                        <p className="text-sm text-amber-200 font-medium">
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-pos-card border-t border-pos-border">
                    {order.status === 'approved' && (
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black text-sm font-black uppercase tracking-wider rounded-sm transition-colors"
                      >
                        Start Cooking &rarr;
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                        className="w-full h-12 bg-green-500 hover:bg-green-400 text-black text-sm font-black uppercase tracking-wider rounded-sm transition-colors"
                      >
                        Ready to Serve &rarr;
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() => handleUpdateStatus(order.id, 'served')}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black uppercase tracking-wider rounded-sm transition-colors"
                      >
                        Mark Served / Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
