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
    <aside
      aria-label="Cart summary"
      className="fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-none border-t border-rule"
    >
      <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wider text-ink-muted font-medium">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          <span className="text-base sm:text-lg font-bold tabular-nums text-ink">
            {formatRupees(totalPaise)}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenReview}
          className="min-h-[44px] h-11 px-5 sm:px-6 bg-chilli hover:bg-chilli-hover text-white text-xs sm:text-sm font-semibold uppercase tracking-wider rounded-sm transition-colors cursor-pointer"
        >
          Your order &rarr;
        </button>
      </div>
    </aside>
  );
}
