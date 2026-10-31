'use client';

import React from 'react';
import { formatRupees } from '@/lib/format';

interface CartBarProps {
  itemCount: number;
  totalPaise: number;
  onOpenReview: () => void;
}

export function CartBar({ itemCount, totalPaise, onOpenReview }: CartBarProps) {
  if (itemCount === 0) return null;

  return (
    <aside aria-label="Cart summary" className="fixed bottom-0 inset-x-0 z-40 bg-ink text-paper px-4 py-3 border-t border-ink/80 flex items-center justify-between shadow-none">
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wider text-paper/70 font-medium">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="text-base font-semibold tabular-nums text-paper">
          {formatRupees(totalPaise)}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenReview}
        className="h-10 px-4 bg-chilli hover:bg-chilli-hover text-white text-sm font-medium rounded-sm border border-transparent active:scale-[0.98] transition-all"
      >
        Your order &rarr;
      </button>
    </aside>
  );
}
