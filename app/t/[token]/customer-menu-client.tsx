'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MenuItemRow } from '@/components/menu/menu-item-row';
import { ComboItemRow } from '@/components/menu/combo-item-row';
import { CartBar } from '@/components/menu/cart-bar';
import { OrderDrawer, CartItem } from '@/components/menu/order-drawer';
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
  const [hasOpenSession, setHasOpenSession] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<RawMenuItem[]>([]);
  const [combos, setCombos] = useState<RawCombo[]>([]);
  const [orders, setOrders] = useState<OrderDisplay[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Filter state: Veg-only toggle
  const [vegOnly, setVegOnly] = useState(false);

  // Active category scroll state
  const [activeTab, setActiveTab] = useState<string>('combos');
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const fetchMenuData = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/menu?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'This QR is not valid. Please ask the waiter.');
      }

      setTable(data.table);
      setHasOpenSession(Boolean(data.hasOpenSession));
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
    // Live polling every 5s for order updates (pending -> approved -> preparing -> ready -> served)
    const interval = setInterval(fetchMenuData, 5000);
    return () => clearInterval(interval);
  }, [fetchMenuData]);

  // Cart operations
  const handleAddItem = (item: RawMenuItem) => {
    if (!hasOpenSession) return;
    setCart(prev => {
      const existing = prev.find(ci => ci.id === item.id && ci.type === 'item');
      if (existing) {
        return prev.map(ci =>
          ci.id === item.id && ci.type === 'item' ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { id: item.id, type: 'item', item, quantity: 1, note: '' }];
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.id === itemId && ci.type === 'item');
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter(ci => !(ci.id === itemId && ci.type === 'item'));
      }
      return prev.map(ci =>
        ci.id === itemId && ci.type === 'item' ? { ...ci, quantity: ci.quantity - 1 } : ci
      );
    });
  };

  const handleUpdateItemNote = (itemId: string, note: string) => {
    setCart(prev =>
      prev.map(ci => (ci.id === itemId && ci.type === 'item' ? { ...ci, note } : ci))
    );
  };

  const handleAddCombo = (combo: RawCombo) => {
    if (!hasOpenSession) return;
    setCart(prev => {
      const existing = prev.find(ci => ci.id === combo.id && ci.type === 'combo');
      if (existing) {
        return prev.map(ci =>
          ci.id === combo.id && ci.type === 'combo' ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { id: combo.id, type: 'combo', combo, quantity: 1, note: '' }];
    });
  };

  const handleRemoveCombo = (comboId: string) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.id === comboId && ci.type === 'combo');
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter(ci => !(ci.id === comboId && ci.type === 'combo'));
      }
      return prev.map(ci =>
        ci.id === comboId && ci.type === 'combo' ? { ...ci, quantity: ci.quantity - 1 } : ci
      );
    });
  };

  const handleUpdateComboNote = (comboId: string, note: string) => {
    setCart(prev =>
      prev.map(ci => (ci.id === comboId && ci.type === 'combo' ? { ...ci, note } : ci))
    );
  };

  const handleUpdateDrawerQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(ci => ci.id === id);
      if (!item) return prev;
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter(ci => ci.id !== id);
      }
      return prev.map(ci => (ci.id === id ? { ...ci, quantity: nextQty } : ci));
    });
  };

  const handleUpdateDrawerNote = (id: string, note: string) => {
    setCart(prev => prev.map(ci => (ci.id === id ? { ...ci, note } : ci)));
  };

  const handleOrderSuccess = (newOrder: any) => {
    setCart([]);
    setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
    fetchMenuData();
  };

  const scrollToSection = (sectionId: string) => {
    setActiveTab(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -120; // header + sticky tabs offset
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const totalCartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);
  const totalCartPaise = cart.reduce((sum, ci) => {
    const rawPrice =
      ci.type === 'item'
        ? ci.item?.price ?? ci.item?.price_paise ?? 0
        : ci.combo?.price ?? ci.combo?.price_paise ?? 0;
    return sum + rawPrice * ci.quantity;
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-ink">
        <p className="font-serif text-lg text-ink-muted animate-pulse">
          Opening menu card...
        </p>
      </div>
    );
  }

  // Token unknown or table disabled
  if (error || !table) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-ink text-center">
        <div className="max-w-xs border border-rule p-6 bg-paper-card rounded-sm">
          <h2 className="font-serif text-xl font-bold text-ink mb-1">
            Manasu
          </h2>
          <p className="text-[11px] uppercase tracking-widest text-ink-muted mb-4">
            Restaurant &middot; Bengaluru
          </p>
          <div className="py-3 px-3 bg-paper border border-rule rounded-sm text-xs font-medium text-chilli">
            {error || 'This QR is not valid. Please ask the waiter.'}
          </div>
        </div>
      </div>
    );
  }

  // Filter items and combos by veg-only toggle
  const filteredCombos = combos.filter(c => {
    if (!vegOnly) return true;
    return c.is_veg !== undefined ? c.is_veg : c.dietary === 'veg';
  });

  return (
    <div className="min-h-screen bg-paper text-ink pb-24 max-w-lg mx-auto border-x border-rule/30">
      {/* Top Printed Header */}
      <header className="px-4 pt-4 pb-3 border-b border-rule bg-paper sticky top-0 z-30">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-ink leading-none">
              Manasu
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-ink-muted mt-0.5">
              Restaurant &middot; Bengaluru
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block px-2.5 py-1 bg-ink text-paper text-xs font-semibold tracking-wide rounded-sm uppercase">
              {table.label}
            </span>
          </div>
        </div>

        {/* Veg-only toggle */}
        <div className="mt-3 flex items-center justify-between border-t border-rule/50 pt-2.5">
          <span className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
            Dietary filter
          </span>
          <button
            type="button"
            onClick={() => setVegOnly(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm transition-colors border ${
              vegOnly
                ? 'bg-ink text-paper border-ink font-semibold'
                : 'bg-white text-ink border-rule hover:bg-paper-subtle'
            }`}
            aria-pressed={vegOnly}
          >
            <DietaryBadge type="veg" size="sm" />
            <span>Veg only</span>
            {vegOnly ? <span className="text-[10px] ml-0.5 text-paper/80">&#10003;</span> : null}
          </button>
        </div>

        {/* Category Navigation Tabs (sticky, scrolls to sections) */}
        <nav
          ref={tabsContainerRef}
          aria-label="Menu categories"
          className="mt-3 -mx-4 px-4 flex items-center gap-2 overflow-x-auto border-t border-rule/50 pt-2 pb-0.5 no-scrollbar"
        >
          {filteredCombos.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('section-combos')}
              className={`shrink-0 px-2.5 py-1 text-xs uppercase tracking-wider rounded-sm transition-colors ${
                activeTab === 'section-combos'
                  ? 'bg-chilli text-white font-medium'
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
                className={`shrink-0 px-2.5 py-1 text-xs uppercase tracking-wider rounded-sm transition-colors ${
                  isActive
                    ? 'bg-chilli text-white font-medium'
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
      <main className="p-4">
        {/* Read-Only Notice when table has NO open session */}
        {!hasOpenSession && (
          <div className="mb-5 p-3.5 bg-paper-card border border-ink/20 rounded-sm text-center">
            <p className="font-serif text-sm font-semibold text-ink">
              Ask the waiter to open your table to order.
            </p>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Browse our printed menu card below while your table is being opened.
            </p>
          </div>
        )}

        {/* Placed order status tracker (live updates: pending, approved, preparing, ready, served) */}
        {orders.length > 0 && <OrderStatusBanner orders={orders} />}

        {/* Combos section (at the top with included items listed in small text) */}
        {filteredCombos.length > 0 && (
          <section id="section-combos" className="mb-6 pt-1">
            <h2 className="font-serif text-xs font-bold tracking-widest uppercase text-ink pb-1 border-b border-rule mb-2">
              Signature Combos
            </h2>
            <div className="divide-y divide-rule/30">
              {filteredCombos.map(combo => {
                const cartItem = cart.find(ci => ci.id === combo.id && ci.type === 'combo');
                return (
                  <ComboItemRow
                    key={combo.id}
                    combo={combo}
                    quantityInCart={cartItem?.quantity || 0}
                    note={cartItem?.note || ''}
                    readOnly={!hasOpenSession}
                    onAdd={() => handleAddCombo(combo)}
                    onRemove={() => handleRemoveCombo(combo.id)}
                    onUpdateNote={note => handleUpdateComboNote(combo.id, note)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Category Sections */}
        {categories.map(category => {
          const categoryItems = items.filter(item => {
            if (item.category_id !== category.id) return false;
            if (!vegOnly) return true;
            return item.is_veg !== undefined ? item.is_veg : item.dietary === 'veg';
          });

          if (categoryItems.length === 0) return null;

          return (
            <section key={category.id} id={`section-${category.id}`} className="mb-6 pt-1">
              <h2 className="font-serif text-xs font-bold tracking-widest uppercase text-ink pb-1 border-b border-rule mb-2">
                {category.name}
              </h2>
              <div>
                {categoryItems.map(item => {
                  const cartItem = cart.find(ci => ci.id === item.id && ci.type === 'item');
                  return (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      quantityInCart={cartItem?.quantity || 0}
                      note={cartItem?.note || ''}
                      readOnly={!hasOpenSession}
                      onAdd={() => handleAddItem(item)}
                      onRemove={() => handleRemoveItem(item.id)}
                      onUpdateNote={note => handleUpdateItemNote(item.id, note)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Printed Card Footer Note */}
        <div className="text-center py-6 border-t border-rule/50 mt-8 text-[11px] text-ink-muted space-y-1">
          <p className="font-serif italic text-ink/80">Prepared fresh with pure desi ghee & spices</p>
          <p>Prices inclusive of local preparation &middot; 5% GST applicable on billing</p>
        </div>
      </main>

      {/* Floating Bottom Cart Bar (active only when table has open session) */}
      {hasOpenSession && (
        <CartBar
          itemCount={totalCartCount}
          totalPaise={totalCartPaise}
          onOpenReview={() => setIsReviewOpen(true)}
        />
      )}

      {/* Order Review & Placement Drawer */}
      {hasOpenSession && (
        <OrderDrawer
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          tableToken={token}
          tableNumber={table.label}
          cart={cart}
          onUpdateQuantity={handleUpdateDrawerQuantity}
          onUpdateNote={handleUpdateDrawerNote}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </div>
  );
}
