'use client';

import React, { useState } from 'react';
import { formatRupees } from '@/lib/format';
import { DietaryBadge } from '../ui/dietary-badge';

export interface CartItem {
  id: string; // item id or combo id
  type: 'item' | 'combo';
  item?: any;
  combo?: any;
  quantity: number;
  note?: string;
  notes?: string;
}

interface OrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tableToken: string;
  tableNumber: string;
  cart: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onUpdateNote?: (id: string, note: string) => void;
  onOrderSuccess: (order: any) => void;
}

export function OrderDrawer({
  isOpen,
  onClose,
  tableToken,
  tableNumber,
  cart,
  onUpdateQuantity,
  onUpdateNote,
  onOrderSuccess,
}: OrderDrawerProps) {
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const totalPaise = cart.reduce((sum, ci) => {
    const rawPrice =
      ci.type === 'item'
        ? ci.item?.price ?? ci.item?.price_paise ?? 0
        : ci.combo?.price ?? ci.combo?.price_paise ?? 0;
    return sum + rawPrice * ci.quantity;
  }, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        token: tableToken,
        tableToken: tableToken,
        orderNote: orderNotes.trim(),
        notes: orderNotes.trim(),
        items: cart.map(ci => ({
          itemId: ci.type === 'item' ? ci.id : undefined,
          comboId: ci.type === 'combo' ? ci.id : undefined,
          quantity: ci.quantity,
          note: ci.note || ci.notes || '',
        })),
      };

      const res = await fetch('/api/customer/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      onOrderSuccess(data.order);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please ask the waiter.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/60">
      <div
        className="w-full max-w-lg md:max-w-xl mx-auto bg-paper text-ink border-t border-rule max-h-[88vh] flex flex-col shadow-none"
        style={{ borderRadius: '4px 4px 0 0' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-ink leading-tight">
              Your order
            </h2>
            <p className="text-xs text-ink-muted">
              {tableNumber} &middot; Sent to the waiter for confirmation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order drawer"
            className="w-10 h-10 flex items-center justify-center border border-rule/80 rounded-sm text-lg text-ink hover:bg-paper-subtle cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Items List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {cart.length === 0 ? (
            <p className="text-sm text-ink-muted py-6 text-center">
              Your order is empty. Add items from the menu card.
            </p>
          ) : (
            cart.map(ci => {
              const name = ci.type === 'item' ? ci.item?.name : ci.combo?.name;
              const rawPrice =
                ci.type === 'item'
                  ? ci.item?.price ?? ci.item?.price_paise ?? 0
                  : ci.combo?.price ?? ci.combo?.price_paise ?? 0;
              const isVeg =
                ci.type === 'item'
                  ? ci.item?.is_veg ?? ci.item?.dietary === 'veg'
                  : ci.combo?.is_veg ?? ci.combo?.dietary === 'veg';
              const itemNote = ci.note || ci.notes || '';

              return (
                <div key={ci.id} className="py-2.5 border-b border-rule/50 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <DietaryBadge type={isVeg ? 'veg' : 'non_veg'} size="sm" />
                      <span className="text-sm font-medium text-ink break-words">
                        {name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold tabular-nums text-ink whitespace-nowrap">
                        {formatRupees(rawPrice * ci.quantity)}
                      </span>

                      <div className="inline-flex items-center border border-ink/30 rounded-sm bg-white overflow-hidden h-8">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(ci.id, -1)}
                          className="w-8 h-full flex items-center justify-center text-ink text-sm font-bold hover:bg-paper-subtle active:bg-paper-subtle"
                          aria-label={`Decrease ${name}`}
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-bold tabular-nums text-ink">
                          {ci.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(ci.id, 1)}
                          className="w-8 h-full flex items-center justify-center text-ink text-sm font-bold hover:bg-paper-subtle active:bg-paper-subtle"
                          aria-label={`Increase ${name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Note for this item */}
                  {itemNote ? (
                    <div className="mt-1 pl-5 flex items-center justify-between text-[11px] text-ink-muted">
                      <span className="italic">Note: {itemNote}</span>
                      {onUpdateNote && (
                        <button
                          type="button"
                          onClick={() => onUpdateNote(ci.id, '')}
                          className="text-[10px] underline hover:text-ink"
                        >
                          Remove note
                        </button>
                      )}
                    </div>
                  ) : onUpdateNote ? (
                    <div className="mt-1 pl-5">
                      <button
                        type="button"
                        onClick={() => {
                          const note = prompt('Add note for this item (e.g. less spicy):');
                          if (note !== null) onUpdateNote(ci.id, note.trim());
                        }}
                        className="text-[11px] text-ink-muted underline decoration-dotted hover:text-ink"
                      >
                        + Add item note
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          {cart.length > 0 && (
            <div className="pt-2">
              <label htmlFor="order-drawer-notes" className="block text-xs uppercase tracking-wider text-ink-muted font-medium mb-1">
                Special instructions for table (optional)
              </label>
              <input
                id="order-drawer-notes"
                type="text"
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="e.g. Please bring water glasses, less spicy"
                maxLength={200}
                className="w-full text-xs px-3 py-2 bg-white border border-rule rounded-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-chilli"
              />
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 bg-chilli-light border border-chilli text-chilli text-xs rounded-sm">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-rule bg-paper-subtle/50 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-ink-muted font-semibold">
                Estimated Total
              </span>
              <span className="text-base font-bold tabular-nums text-ink">
                {formatRupees(totalPaise)}
              </span>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handlePlaceOrder}
              className="w-full h-11 bg-chilli hover:bg-chilli-hover disabled:opacity-50 text-white text-sm font-semibold rounded-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? 'Placing order...' : 'Place order'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
