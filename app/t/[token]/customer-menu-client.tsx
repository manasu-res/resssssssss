'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MenuItemRow } from '@/components/menu/menu-item-row';
import { ComboItemRow } from '@/components/menu/combo-item-row';
import { OrderStatusBanner, OrderDisplay } from '@/components/menu/order-status-banner';
import { DietaryBadge } from '@/components/ui/dietary-badge';

interface CustomerMenuClientProps {
  token: string;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface RawMenuItem {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price?: number;
  price_paise?: number;
  is_veg?: boolean;
  dietary?: 'veg' | 'non_veg';
  is_available?: boolean;
  sort_order: number;
}

interface RawCombo {
  id: string;
  name: string;
  description?: string | null;
  price?: number;
  price_paise?: number;
  is_veg?: boolean;
  dietary?: 'veg' | 'non_veg';
  is_available?: boolean;
  sort_order?: number;
  includedItems?: Array<{ id?: string; name: string; quantity: number }>;
  items?: Array<{ id?: string; name: string; quantity: number }>;
}

export default function CustomerMenuClient({ token }: CustomerMenuClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<{ id: string; label: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<RawMenuItem[]>([]);
  const [combos, setCombos] = useState<RawCombo[]>([]);
  const [orders, setOrders] = useState<OrderDisplay[]>([]);

  // Filter state: Veg-only toggle
  const [vegOnly, setVegOnly] = useState(false);

  // Active category scroll state
  const [activeTab, setActiveTab] = useState<string>('combos');
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const fetchMenuData = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/menu?token=${encodeURIComponent(token)}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'This QR is not valid. Please ask the waiter.');
      }

      setTable(data.table);
      setCategories(data.categories || []);
      setItems(data.items || []);
      setCombos(data.combos || []);
      setOrders(data.orders || data.activeOrders || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'This QR is not valid. Please ask the waiter.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMenuData();
    // Live polling every 5s for live order status updates
    const interval = setInterval(fetchMenuData, 5000);
    return () => clearInterval(interval);
  }, [fetchMenuData]);

  const scrollToSection = (sectionId: string) => {
    setActiveTab(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -120; // header + sticky tabs offset
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-ink">
        <p className="font-serif text-lg text-ink-muted animate-pulse">
          Opening menu card...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-ink">
        <div className="max-w-md w-full p-6 bg-paper-card border border-rule text-center rounded-sm">
          <h1 className="font-serif text-2xl font-bold text-chilli mb-2">Notice</h1>
          <p className="text-sm text-ink-muted mb-6">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchMenuData();
            }}
            className="w-full py-2.5 bg-ink text-paper text-xs uppercase font-semibold tracking-wider rounded-sm hover:bg-ink-light transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const filteredCombos = vegOnly
    ? combos.filter(c => (c.is_veg !== undefined ? c.is_veg : c.dietary === 'veg'))
    : combos;

  const rawTable = (table?.label || '').trim();
  const cleanTableNum = rawTable.replace(/^(table\s*)+/i, '').trim();
  const displayTable = cleanTableNum ? `Table ${cleanTableNum}` : (rawTable || 'Table');

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-chilli selection:text-white pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur-none border-b border-rule">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink">
              Manasu
            </h1>
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-ink-muted font-medium">
              Restaurant &middot; Bengaluru
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Table Number Pill */}
            <span className="px-3 py-1 bg-ink text-paper text-xs font-bold uppercase tracking-wider rounded-sm">
              {displayTable}
            </span>

            {/* Veg Only Toggle */}
            <button
              type="button"
              onClick={() => setVegOnly(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-sm font-semibold transition-colors cursor-pointer ${
                vegOnly
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                  : 'border-rule bg-white text-ink-muted hover:text-ink'
              }`}
            >
              <DietaryBadge type="veg" size="sm" />
              <span>Veg only</span>
            </button>
          </div>
        </div>

        {/* Sticky Horizontal Categories Tab Bar */}
        <nav
          ref={tabsContainerRef}
          aria-label="Menu categories"
          className="max-w-4xl mx-auto px-4 py-2 border-t border-rule/50 flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth"
        >
          {filteredCombos.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('section-combos')}
              className={`shrink-0 px-3 py-1 text-xs uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                activeTab === 'section-combos'
                  ? 'bg-chilli text-white font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Combos
            </button>
          )}

          {categories.map(category => {
            const catItems = items.filter(it => it.category_id === category.id);
            const hasVisibleItems = vegOnly
              ? catItems.some(it => (it.is_veg !== undefined ? it.is_veg : it.dietary === 'veg'))
              : catItems.length > 0;

            if (!hasVisibleItems) return null;

            const sectionId = `section-${category.id}`;
            const isActive = activeTab === sectionId;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => scrollToSection(sectionId)}
                className={`shrink-0 px-3 py-1 text-xs uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-chilli text-white font-semibold'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Menu Body */}
      <main className="max-w-4xl mx-auto px-4 py-5">
        {/* Floor Waiter Notice Card */}
        <div className="mb-6 p-4 sm:p-5 bg-paper-card border border-rule rounded-sm text-center">
          <p className="font-serif text-base sm:text-lg font-bold text-ink">
            Welcome to Manasu
          </p>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-md mx-auto">
            Please explore our traditional South Indian menu below. Your floor captain will take your order directly at your table.
          </p>
        </div>

        {/* Live Order Status Tracker (shows live updates if waiter placed an order for this table) */}
        {orders.length > 0 && (
          <div className="mb-6">
            <OrderStatusBanner orders={orders} />
          </div>
        )}

        {/* Combos section */}
        {filteredCombos.length > 0 && (
          <section id="section-combos" className="mb-8 pt-1 border-b border-rule/50 pb-6">
            <h2 className="font-serif text-xs sm:text-sm font-bold tracking-widest uppercase text-ink pb-1 border-b border-rule mb-3">
              Combos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              {filteredCombos.map(combo => (
                <ComboItemRow
                  key={combo.id}
                  combo={combo}
                  quantityInCart={0}
                  readOnly={true}
                  onAdd={() => {}}
                  onRemove={() => {}}
                />
              ))}
            </div>
          </section>
        )}

        {/* Category Sections: 2 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 items-start">
          {categories.map(category => {
            const categoryItems = items.filter(item => {
              if (item.category_id !== category.id) return false;
              if (!vegOnly) return true;
              return item.is_veg !== undefined ? item.is_veg : item.dietary === 'veg';
            });

            if (categoryItems.length === 0) return null;

            return (
              <section key={category.id} id={`section-${category.id}`} className="pt-1">
                <h2 className="font-serif text-xs sm:text-sm font-bold tracking-widest uppercase text-ink pb-1 border-b border-rule mb-2">
                  {category.name}
                </h2>
                <div>
                  {categoryItems.map(item => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      quantityInCart={0}
                      readOnly={true}
                      onAdd={() => {}}
                      onRemove={() => {}}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Printed Card Footer Note */}
        <div className="text-center py-8 border-t border-rule/50 mt-12 space-y-1.5 text-xs text-ink-muted">
          <p className="font-serif font-bold text-ink">
            To place an order or request assistance, please call your floor waiter.
          </p>
          <p>Dishes prepared fresh to order &middot; Authentic traditional flavours &middot; Indiranagar, Bengaluru</p>
        </div>
      </main>
    </div>
  );
}
