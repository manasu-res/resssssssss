'use client';

import React from 'react';
import { MenuItem } from '@/lib/types';
import { formatRupees } from '@/lib/format';
import { DietaryBadge } from '../ui/dietary-badge';

interface MenuItemRowProps {
  item: MenuItem;
  quantityInCart: number;
  onAdd: () => void;
  onRemove: () => void;
}

export function MenuItemRow({
  item,
  quantityInCart,
  onAdd,
  onRemove,
}: MenuItemRowProps) {
  return (
    <div className="py-2.5 border-b border-rule/40 last:border-b-0">
      <div className="flex items-baseline justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <DietaryBadge type={item.dietary} size="sm" />
          <span className="font-medium text-sm text-ink truncate leading-tight">
            {item.name}
          </span>
        </div>

        <div className="flex-1 border-b border-dotted border-rule/60 mx-1.5 mb-1 shrink min-w-[12px]" />

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-medium text-sm text-ink tabular-nums">
            {formatRupees(item.price_paise)}
          </span>

          {quantityInCart > 0 ? (
            <div className="inline-flex items-center border border-ink/30 rounded-sm bg-white overflow-hidden h-7">
              <button
                type="button"
                onClick={onRemove}
                className="w-6 h-full flex items-center justify-center text-ink text-sm font-semibold hover:bg-paper-subtle active:bg-paper-subtle"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="w-5 text-center text-xs font-semibold tabular-nums text-ink">
                {quantityInCart}
              </span>
              <button
                type="button"
                onClick={onAdd}
                className="w-6 h-full flex items-center justify-center text-ink text-sm font-semibold hover:bg-paper-subtle active:bg-paper-subtle"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="h-7 px-2.5 border border-ink/40 text-xs font-medium rounded-sm bg-white text-ink hover:border-chilli hover:text-chilli active:bg-paper-subtle transition-colors"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {item.description && (
        <p className="text-[12px] text-ink-muted leading-normal mt-0.5 pl-5 pr-16 line-clamp-2">
          {item.description}
        </p>
      )}
    </div>
  );
}
