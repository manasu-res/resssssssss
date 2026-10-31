'use client';

import React from 'react';
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
  status: 'pending' | 'approved' | 'preparing' | 'ready' | 'served' | 'cancelled';
  source?: string;
  created_at: string;
  order_lines?: OrderItemDisplay[];
  items?: OrderItemDisplay[];
}

interface OrderStatusBannerProps {
  orders: OrderDisplay[];
}

export function OrderStatusBanner({ orders }: OrderStatusBannerProps) {
  if (!orders || orders.length === 0) return null;

  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  if (activeOrders.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {activeOrders.map(order => {
        const orderLines = order.order_lines || order.items || [];
        const orderIdShort = order.order_number ? `#${order.order_number}` : order.id.slice(-4).toUpperCase();

        let headline = 'Sent to the waiter. We\'ll confirm shortly.';
        let statusBadge = {
          label: 'Pending waiter approval',
          bg: 'bg-amber-100',
          border: 'border-amber-300',
          text: 'text-amber-900',
        };
        let subtext: string | null = 'The order does not go to the kitchen until a waiter approves it.';

        if (order.status === 'approved') {
          headline = 'Order confirmed by waiter';
          statusBadge = {
            label: 'Approved & sent to kitchen',
            bg: 'bg-blue-50',
            border: 'border-blue-300',
            text: 'text-blue-900',
          };
          subtext = null;
        } else if (order.status === 'preparing') {
          headline = 'Preparing your food';
          statusBadge = {
            label: 'Cooking in kitchen',
            bg: 'bg-orange-50',
            border: 'border-orange-300',
            text: 'text-orange-900',
          };
          subtext = null;
        } else if (order.status === 'ready') {
          headline = 'Food is ready';
          statusBadge = {
            label: 'Ready to serve',
            bg: 'bg-emerald-50',
            border: 'border-emerald-400',
            text: 'text-emerald-900',
          };
          subtext = null;
        } else if (order.status === 'served') {
          headline = 'Order served';
          statusBadge = {
            label: 'Served to table',
            bg: 'bg-stone-100',
            border: 'border-stone-300',
            text: 'text-stone-800',
          };
          subtext = null;
        }

        return (
          <div
            key={order.id}
            className={`p-3.5 border rounded-sm ${statusBadge.bg} ${statusBadge.border} text-xs`}
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

              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold border ${statusBadge.border} ${statusBadge.text} bg-white rounded-sm shrink-0`}>
                {statusBadge.label}
              </span>
            </div>

            {subtext && (
              <p className="mt-1.5 text-[11px] text-ink-muted italic">
                {subtext}
              </p>
            )}

            {orderLines.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-ink/10 space-y-1">
                {orderLines.map((line, idx) => {
                  const name = line.name_snapshot || line.item_name || 'Item';
                  const note = line.note || line.notes || '';
                  return (
                    <div key={line.id || idx} className="flex justify-between items-baseline text-[11px] text-ink/90">
                      <span>
                        <span className="font-semibold">{line.quantity}&times;</span> {name}
                        {note ? <span className="text-ink-muted italic ml-1">({note})</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
