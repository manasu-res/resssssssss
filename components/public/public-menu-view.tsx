'use client';

import React, { useState } from 'react';
import { formatRupees } from '@/lib/format';
import { DietaryBadge } from '@/components/ui/dietary-badge';

export interface PublicMenuItem {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price_paise: number;
  dietary: 'veg' | 'non_veg';
  is_available: boolean;
  sort_order: number;
}

export interface PublicCombo {
  id: string;
  name: string;
  description?: string;
  price_paise: number;
  dietary: 'veg' | 'non_veg';
  is_available: boolean;
  items?: Array<{ name: string; quantity: number }>;
}

export interface PublicCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface PublicMenuViewProps {
  categories: PublicCategory[];
  items: PublicMenuItem[];
  combos: PublicCombo[];
}

export function PublicMenuView({ categories, items, combos }: PublicMenuViewProps) {
  const [vegOnly, setVegOnly] = useState(false);

  const filteredCombos = combos.filter(c => (!vegOnly ? true : c.dietary === 'veg'));
  const filteredItems = items.filter(i => (!vegOnly ? true : i.dietary === 'veg'));

  return (
    <section id="menu" className="scroll-mt-8 py-8 border-t border-rule">
      {/* Menu Header with Veg-Only Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 pb-2 border-b border-rule">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
            The Menu
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Prepared fresh to order using traditional South Indian recipes
          </p>
        </div>

        {/* Veg-Only Filter Toggle */}
        <button
          type="button"
          onClick={() => setVegOnly(!vegOnly)}
          className={`self-start sm:self-auto px-3 py-1.5 border text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer flex items-center gap-2 ${
            vegOnly
              ? 'bg-veg text-white border-veg'
              : 'bg-white text-ink border-rule hover:border-ink'
          }`}
          aria-pressed={vegOnly}
        >
          <span className={`w-2 h-2 rounded-full ${vegOnly ? 'bg-white' : 'bg-veg'}`} />
          <span>Veg only</span>
        </button>
      </div>

      {/* COMBOS SECTION (At the very top) */}
      {filteredCombos.length > 0 && (
        <div className="mb-10">
          <div className="border-b border-rule pb-1 mb-4 flex items-baseline justify-between">
            <h3 className="text-xs uppercase tracking-widest font-black text-ink">
              Special Combos & Thalis
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">
              Curated Meal Sets
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12 gap-y-4">
            {filteredCombos.map(combo => {
              const isAvailable = combo.is_available !== false;
              return (
                <div
                  key={combo.id}
                  className={`py-2 border-b border-rule/40 last:border-b-0 ${
                    !isAvailable ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <DietaryBadge type={combo.dietary} size="sm" />
                      <span
                        className={`font-semibold text-sm sm:text-base text-ink ${
                          !isAvailable ? 'line-through text-ink-muted' : ''
                        }`}
                      >
                        {combo.name}
                      </span>
                    </div>

                    <div className="hidden sm:block flex-1 border-b border-dotted border-rule/60 mx-2 mb-1 min-w-[12px]" />

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="font-semibold text-sm sm:text-base text-ink tabular-nums">
                        {formatRupees(combo.price_paise)}
                      </span>
                      {!isAvailable && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold border border-red-300 text-red-900 bg-red-100 rounded-sm uppercase tracking-wider">
                          Sold out
                        </span>
                      )}
                    </div>
                  </div>

                  {combo.description && (
                    <p className="text-[11px] text-ink-muted leading-relaxed mt-0.5 pl-5">
                      {combo.description}
                    </p>
                  )}
                  {combo.items && combo.items.length > 0 && (
                    <p className="text-[10px] text-ink-muted italic pl-5 mt-0.5">
                      Includes: {combo.items.map(it => `${it.name}${it.quantity > 1 ? ` (x${it.quantity})` : ''}`).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CATEGORIES & ITEMS */}
      <div className="space-y-10">
        {categories.map(category => {
          const categoryItems = filteredItems.filter(i => i.category_id === category.id);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.id} className="scroll-mt-6">
              {/* Category Heading in small caps with thin rule */}
              <div className="border-b border-rule pb-1 mb-4 flex items-baseline justify-between">
                <h3 className="text-xs uppercase tracking-widest font-black text-ink">
                  {category.name}
                </h3>
              </div>

              {/* 2 columns on laptop and large screens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12 gap-y-3">
                {categoryItems.map(item => {
                  const isAvailable = item.is_available !== false;
                  return (
                    <div
                      key={item.id}
                      className={`py-2 border-b border-rule/30 last:border-b-0 ${
                        !isAvailable ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <DietaryBadge type={item.dietary} size="sm" />
                          <span
                            className={`font-semibold text-sm sm:text-base text-ink ${
                              !isAvailable ? 'line-through text-ink-muted' : ''
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>

                        <div className="hidden sm:block flex-1 border-b border-dotted border-rule/60 mx-2 mb-1 min-w-[12px]" />

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="font-semibold text-sm sm:text-base text-ink tabular-nums">
                            {formatRupees(item.price_paise)}
                          </span>
                          {!isAvailable && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold border border-red-300 text-red-900 bg-red-100 rounded-sm uppercase tracking-wider">
                              Sold out
                            </span>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-[11px] text-ink-muted leading-relaxed mt-0.5 pl-5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Note: Ordering instructions */}
      <div className="mt-12 pt-6 border-t border-rule text-center">
        <p className="font-serif text-base sm:text-lg font-bold text-ink">
          To order, scan the QR code on your table.
        </p>
        <p className="text-xs text-ink-muted mt-1">
          Each dining table has a unique QR code for instant table ordering.
        </p>
      </div>
    </section>
  );
}
