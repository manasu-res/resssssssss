'use client';

import React, { useState } from 'react';
import { formatRupees } from '@/lib/format';
import { DietaryBadge } from '../ui/dietary-badge';

interface MenuItemRowProps {
  item: {
    id: string;
    name: string;
    description?: string | null;
    price?: number;
    price_paise?: number;
    is_veg?: boolean;
    dietary?: 'veg' | 'non_veg';
    is_available?: boolean;
  };
  quantityInCart: number;
  note?: string;
  readOnly?: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onUpdateNote?: (note: string) => void;
}

export function MenuItemRow({
  item,
  quantityInCart,
  note = '',
  readOnly = false,
  onAdd,
  onRemove,
  onUpdateNote,
}: MenuItemRowProps) {
  const [showNoteInput, setShowNoteInput] = useState(Boolean(note));
  const isVeg = item.is_veg !== undefined ? item.is_veg : item.dietary === 'veg';
  const isAvailable = item.is_available !== false;
  const pricePaise = item.price !== undefined ? item.price : item.price_paise || 0;

  return (
    <div className={`py-2.5 sm:py-3 border-b border-rule/40 last:border-b-0 ${!isAvailable ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          <div className="pt-0.5 shrink-0">
            <DietaryBadge type={isVeg ? 'veg' : 'non_veg'} size="sm" />
          </div>
          <span className={`font-medium text-sm md:text-base text-ink leading-snug break-words ${!isAvailable ? 'line-through text-ink-muted' : ''}`}>
            {item.name}
          </span>
        </div>

        <div className="hidden sm:block flex-1 border-b border-dotted border-rule/60 mx-1.5 mb-1.5 shrink min-w-[12px]" />

        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <span className="font-semibold text-sm md:text-base text-ink tabular-nums whitespace-nowrap">
            {formatRupees(pricePaise)}
          </span>

          {!readOnly && (
            <>
              {!isAvailable ? (
                <span className="px-2 py-1 text-[11px] font-medium border border-rule text-ink-muted bg-paper-subtle rounded-sm uppercase tracking-wider">
                  Sold out
                </span>
              ) : quantityInCart > 0 ? (
                <div className="inline-flex items-center border border-ink/30 rounded-sm bg-white overflow-hidden h-9 sm:h-7">
                  <button
                    type="button"
                    onClick={onRemove}
                    className="w-8 sm:w-6 h-full flex items-center justify-center text-ink text-base sm:text-sm font-semibold hover:bg-paper-subtle active:bg-paper-subtle"
                    aria-label={`Decrease quantity of ${item.name}`}
                  >
                    -
                  </button>
                  <span className="w-6 sm:w-5 text-center text-xs font-semibold tabular-nums text-ink">
                    {quantityInCart}
                  </span>
                  <button
                    type="button"
                    onClick={onAdd}
                    className="w-8 sm:w-6 h-full flex items-center justify-center text-ink text-base sm:text-sm font-semibold hover:bg-paper-subtle active:bg-paper-subtle"
                    aria-label={`Increase quantity of ${item.name}`}
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onAdd}
                  className="min-h-[36px] sm:min-h-0 sm:h-7 px-3 sm:px-2.5 border border-ink/40 text-xs font-semibold rounded-sm bg-white text-ink hover:border-chilli hover:text-chilli active:bg-paper-subtle transition-colors shadow-none"
                >
                  Add
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {item.description && (
        <p className="text-[12px] md:text-xs text-ink-muted leading-normal mt-1 pl-5 pr-2 sm:pr-12">
          {item.description}
        </p>
      )}

      {/* Item specific note when in cart */}
      {!readOnly && isAvailable && quantityInCart > 0 && onUpdateNote && (
        <div className="mt-1.5 pl-5">
          {showNoteInput ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={note}
                onChange={e => onUpdateNote(e.target.value)}
                placeholder="Note (e.g. less spicy)"
                maxLength={80}
                className="text-[11px] px-2 py-1 bg-white border border-rule rounded-sm text-ink placeholder:text-ink-faint w-full max-w-xs focus:outline-none focus:border-chilli"
              />
              {note ? (
                <button
                  type="button"
                  onClick={() => onUpdateNote('')}
                  className="text-[10px] text-ink-muted hover:text-ink shrink-0 px-1"
                >
                  Clear
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNoteInput(false)}
                  className="text-[10px] text-ink-muted hover:text-ink shrink-0 px-1"
                >
                  Hide
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNoteInput(true)}
              className="text-[11px] text-ink-muted underline decoration-dotted hover:text-ink"
            >
              + Note {note ? `("${note}")` : '(e.g. less spicy)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
