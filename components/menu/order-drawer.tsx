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
  onRequestCodeEntry?: () => void;
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
  onRequestCodeEntry,
}: OrderDrawerProps) {
  const [step, setStep] = useState<'cart' | 'review'>('cart');
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

  const totalItemsCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const handleConfirmAndSend = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setErrorMessage('');

    // Generate unique idempotency key so double-tap or retries never duplicate orders
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        token: tableToken,
        orderNote: orderNotes.trim(),
        idempotencyKey,
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
        if (data.requiresCode && onRequestCodeEntry) {
          onClose();
          onRequestCodeEntry();
          return;
        }
        throw new Error(data.error || 'Failed to place order');
      }

      onOrderSuccess(data.order);
      setStep('cart');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please ask the waiter.');
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
            <h3 className="font-serif text-lg font-bold text-ink">
              {step === 'cart' ? 'Your Cart' : 'Review Order'}
            </h3>
            <p className="text-xs text-ink-muted">
              {tableNumber} &middot; {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-rule rounded-sm hover:bg-paper-subtle text-ink font-bold"
            aria-label="Close cart"
          >
            &times;
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-3 bg-paper-card border border-chilli text-chilli text-xs rounded-sm">
            {errorMessage}
          </div>
        )}

        {/* Content Area */}
        {step === 'cart' ? (
          /* STEP 1: CART SHEET */
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-ink-muted text-xs">
                Your cart is empty. Add items from the menu card.
              </div>
            ) : (
              cart.map(ci => {
                const isItem = ci.type === 'item';
                const name = isItem ? ci.item?.name : ci.combo?.name;
                const price =
                  isItem
                    ? ci.item?.price ?? ci.item?.price_paise ?? 0
                    : ci.combo?.price ?? ci.combo?.price_paise ?? 0;
                const dietary =
                  isItem
                    ? ci.item?.dietary || (ci.item?.is_veg ? 'veg' : 'non_veg')
                    : ci.combo?.dietary || (ci.combo?.is_veg ? 'veg' : 'non_veg');

                return (
                  <div key={ci.id} className="p-3 border border-rule/60 bg-white rounded-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <div className="pt-0.5 shrink-0">
                          <DietaryBadge type={dietary} size="sm" />
                        </div>
                        <span className="font-medium text-xs text-ink leading-tight">
                          {name}
                        </span>
                      </div>

                      <span className="font-semibold text-xs tabular-nums text-ink shrink-0">
                        {formatRupees(price * ci.quantity)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Quantity Controls */}
                      <div className="inline-flex items-center border border-ink/30 rounded-sm bg-paper-subtle overflow-hidden h-7">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(ci.id, -1)}
                          className="w-7 h-full flex items-center justify-center font-bold text-xs hover:bg-ink hover:text-white transition-colors"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-bold text-xs tabular-nums text-ink">
                          {ci.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(ci.id, 1)}
                          className="w-7 h-full flex items-center justify-center font-bold text-xs hover:bg-ink hover:text-white transition-colors"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(ci.id, -ci.quantity)}
                        className="text-[11px] text-ink-muted hover:text-chilli underline"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Note input per item */}
                    {onUpdateNote && (
                      <input
                        type="text"
                        value={ci.note || ''}
                        onChange={e => onUpdateNote(ci.id, e.target.value)}
                        placeholder="Add cooking instruction (e.g. less spicy, crisp)"
                        className="w-full text-[11px] px-2 py-1 border border-rule rounded-sm focus:outline-none focus:border-ink bg-paper-subtle/40"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* STEP 2: REVIEW ORDER SCREEN */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="p-3 bg-paper-card border border-rule rounded-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">
                  Ordering For
                </span>
                <p className="font-serif text-base font-bold text-ink">
                  {tableNumber}
                </p>
              </div>
              <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-sm">
                Direct to kitchen
              </span>
            </div>

            {/* Order Items Summary */}
            <div className="border border-rule bg-white rounded-sm divide-y divide-rule/40 p-3 space-y-2">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1">
                Order Items Summary
              </span>
              {cart.map(ci => {
                const isItem = ci.type === 'item';
                const name = isItem ? ci.item?.name : ci.combo?.name;
                const price =
                  isItem
                    ? ci.item?.price ?? ci.item?.price_paise ?? 0
                    : ci.combo?.price ?? ci.combo?.price_paise ?? 0;
                return (
                  <div key={ci.id} className="pt-2 flex justify-between text-xs">
                    <div>
                      <span className="font-bold text-ink">{ci.quantity}x</span>{' '}
                      <span className="font-medium text-ink">{name}</span>
                      {ci.note && (
                        <span className="block text-[10px] text-ink-muted italic pl-4">
                          Note: {ci.note}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-ink tabular-nums">
                      {formatRupees(price * ci.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* General Kitchen Notes */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-1">
                Optional note for kitchen
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="e.g. Serve together, urgent, separate plates"
                className="w-full text-xs px-3 py-2 border border-rule rounded-sm focus:outline-none focus:border-ink bg-white"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-rule bg-paper space-y-2.5 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="uppercase tracking-wider font-bold text-ink-muted">
                Total Amount
              </span>
              <span className="font-serif text-lg font-bold text-ink tabular-nums">
                {formatRupees(totalPaise)}
              </span>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('review')}
                className="w-full min-h-[48px] bg-chilli text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-chilli-hover transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                Review order &rarr;
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmAndSend}
                  className="w-full min-h-[48px] bg-chilli disabled:bg-chilli/60 text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-chilli-hover transition-colors cursor-pointer flex items-center justify-center"
                >
                  {submitting ? 'Sending to kitchen...' : 'Confirm and send to kitchen \u2192'}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep('cart')}
                  className="w-full py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink text-center cursor-pointer"
                >
                  &larr; Back to edit items
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
