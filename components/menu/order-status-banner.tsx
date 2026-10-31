'use client';

import React from 'react';
import { Order } from '@/lib/types';
import { formatTimeAgo } from '@/lib/format';

interface OrderStatusBannerProps {
  orders: Order[];
}

export function OrderStatusBanner({ orders }: OrderStatusBannerProps) {
  if (!orders || orders.length === 0) return null;

  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  if (activeOrders.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {activeOrders.map(order => {
        let statusBadge = {
          label: 'Sent to the waiter',
          bg: 'bg-paper-subtle',
          border: 'border-rule',
          text: 'text-ink',
        };

        if (order.status === 'pending') {
          statusBadge = {
            label: 'Sent to waiter (Pending approval)',
            bg: 'bg-amber-50',
            border: 'border-amber-300',
            text: 'text-amber-900',
          };
        } else if (order.status === 'approved') {
          statusBadge = {
            label: 'Approved & Sent to kitchen',
            bg: 'bg-blue-50',
            border: 'border-blue-300',
            text: 'text-blue-900',
          };
        } else if (order.status === 'preparing') {
          statusBadge = {
            label: 'Cooking in kitchen',
            bg: 'bg-orange-50',
            border: 'border-orange-300',
            text: 'text-orange-900',
          };
        } else if (order.status === 'ready') {
          statusBadge = {
            label: 'Ready to serve',
            bg: 'bg-green-50',
            border: 'border-green-300',
            text: 'text-green-900',
          };
        } else if (order.status === 'served') {
          statusBadge = {
            label: 'Served to table',
            bg: 'bg-gray-100',
            border: 'border-gray-300',
            text: 'text-gray-800',
          };
        }

        return (
          <div
            key={order.id}
            className={`p-3 border rounded-sm ${statusBadge.bg} ${statusBadge.border} text-xs`}
          >
            <div className="flex items-center justify-between font-medium">
              <span className="font-serif text-sm font-bold text-ink">
                Order #{order.order_number}
              </span>
              <span className="text-[11px] text-ink-muted">
                {formatTimeAgo(order.created_at)}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span className={`font-semibold ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
              <span className="text-[11px] text-ink-muted">
                {order.items?.length || 0} items
              </span>
            </div>

            {order.items && order.items.length > 0 && (
              <div className="mt-2 pt-2 border-t border-ink/10 space-y-0.5 text-ink/80">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-[11px]">
                    <span>
                      {item.quantity}x {item.item_name}
                    </span>
                    {item.notes ? (
                      <span className="text-ink-muted italic">({item.notes})</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
