'use client';

import React, { useState, useEffect } from 'react';
import { formatTimeAgo } from '@/lib/format';

export interface OrderItemDisplay {
  id?: string;
  name_snapshot?: string;
  item_name?: string;
  quantity: number;
  note?: string;
  notes?: string;
}

export interface OrderDisplay {
  id: string;
  order_number?: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'pending' | 'approved';
  source?: string;
  needs_confirmation?: boolean;
  created_at: string;
  order_lines?: OrderItemDisplay[];
  items?: OrderItemDisplay[];
}

interface OrderStatusBannerProps {
  orders: OrderDisplay[];
  onCancelOrder?: (orderId: string) => Promise<void>;
}

export function OrderStatusBanner({ orders, onCancelOrder }: OrderStatusBannerProps) {
  const [now, setNow] = useState(Date.now());
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!orders || orders.length === 0) return null;

  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  if (activeOrders.length === 0) return null;

  const handleCancelClick = async (orderId: string) => {
    if (!onCancelOrder || cancellingId) return;
    if (!confirm('Cancel this order? This can only be undone within 60 seconds of ordering.')) {
      return;
    }
    setCancellingId(orderId);
    try {
      await onCancelOrder(orderId);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="mb-6 space-y-3">
      {activeOrders.map(order => {
        const orderLines = order.order_lines || order.items || [];
        const orderIdShort = order.order_number ? `#${order.order_number}` : order.id.slice(-4).toUpperCase();
        const orderAgeSec = Math.floor((now - new Date(order.created_at).getTime()) / 1000);
        const undoRemainingSec = Math.max(0, 60 - orderAgeSec);

        const isPlaced = order.status === 'placed' || order.status === 'pending';
        const isPreparing = order.status === 'preparing' || order.status === 'approved';
        const isReady = order.status === 'ready';
        const isServed = order.status === 'served';
        const needsConfirmation = Boolean(order.needs_confirmation);

        let headline = 'Sent to kitchen';
        let statusBadge = {
          label: 'Placed & sent to kitchen',
          bg: 'bg-emerald-50',
          border: 'border-emerald-300',
          text: 'text-emerald-900',
        };
        let subtext: string | null = 'The kitchen has received your order.';

        if (needsConfirmation) {
          headline = 'Large order — waiter confirming';
          statusBadge = {
            label: 'Needs confirmation',
            bg: 'bg-amber-100',
            border: 'border-amber-300',
            text: 'text-amber-900',
          };
          subtext = 'Your order exceeds ₹5,000. A floor waiter will confirm at your table shortly.';
        } else if (isPreparing) {
          headline = 'Preparing your food';
          statusBadge = {
            label: 'Cooking in kitchen',
            bg: 'bg-orange-50',
            border: 'border-orange-300',
            text: 'text-orange-900',
          };
          subtext = 'The chef has started cooking your order.';
        } else if (isReady) {
          headline = 'Food is ready';
          statusBadge = {
            label: 'Ready to serve',
            bg: 'bg-emerald-50',
            border: 'border-emerald-400',
            text: 'text-emerald-900',
          };
          subtext = 'Your food is ready and will be brought to your table shortly.';
        } else if (isServed) {
          headline = 'Order served';
          statusBadge = {
            label: 'Served to table',
            bg: 'bg-stone-100',
            border: 'border-stone-300',
            text: 'text-stone-800',
          };
          subtext = null;
        }

        // 60-second undo is available only while kitchen has not tapped Start (status === 'placed')
        const canUndo = isPlaced && !isPreparing && undoRemainingSec > 0;

        return (
          <div
            key={order.id}
            className={`p-3.5 border rounded-sm ${statusBadge.bg} ${statusBadge.border} text-xs transition-colors`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-serif text-sm font-bold text-ink leading-tight">
                  {headline}
                </p>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Order {orderIdShort} &middot; {formatTimeAgo(order.created_at)}
                </p>
              </div>

              <span
                className={`font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-sm border ${statusBadge.border} ${statusBadge.text} bg-white shrink-0`}
              >
                {statusBadge.label}
              </span>
            </div>

            {subtext && (
              <p className="text-[11px] text-ink mt-1.5 leading-snug">
                {subtext}
              </p>
            )}

            {/* 60s Undo Button / Notice */}
            {canUndo && onCancelOrder && (
              <div className="mt-2.5 pt-2 border-t border-ink/10 flex items-center justify-between">
                <span className="text-[11px] text-ink-muted font-medium">
                  Undo available for <span className="font-mono font-bold text-chilli">{undoRemainingSec}s</span>
                </span>
                <button
                  type="button"
                  disabled={cancellingId === order.id}
                  onClick={() => handleCancelClick(order.id)}
                  className="px-2.5 py-1 bg-white border border-chilli text-chilli hover:bg-chilli hover:text-white rounded-sm text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {cancellingId === order.id ? 'Cancelling...' : 'Cancel order'}
                </button>
              </div>
            )}

            {/* Itemized snapshot preview */}
            <div className="mt-2.5 pt-2 border-t border-ink/10 space-y-1">
              {orderLines.map((line, idx) => (
                <div key={line.id || idx} className="flex justify-between text-[11px] text-ink-muted">
                  <span>
                    <span className="font-bold text-ink">{line.quantity}x</span>{' '}
                    {line.name_snapshot || line.item_name}
                    {(line.note || line.notes) ? ` (${line.note || line.notes})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
