'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MenuItem, MenuCategory, Combo, Order } from '@/lib/types';
import { MenuItemRow } from '@/components/menu/menu-item-row';
import { ComboItemRow } from '@/components/menu/combo-item-row';
import { CartBar } from '@/components/menu/cart-bar';
import { OrderDrawer, CartItem } from '@/components/menu/order-drawer';
import { OrderStatusBanner } from '@/components/menu/order-status-banner';
import { DietaryBadge } from '@/components/ui/dietary-badge';

interface CustomerMenuClientProps {
  token: string;
}

export default function CustomerMenuClient({ token }: CustomerMenuClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<{ id: string; table_number: string; seat_capacity: number; status: string } | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Filter state
  const [filter, setFilter] = useState<'all' | 'veg' | 'non_veg'>('all');

  const fetchMenuData = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/menu?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load menu');
      }

      setTable(data.table);
      setCategories(data.categories || []);
      setItems(data.items || []);
      setCombos(data.combos || []);
      setActiveOrders(data.activeOrders || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load menu. Please call a waiter.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMenuData();
    // Poll every 8s for live order updates
    const interval = setInterval(fetchMenuData, 8000);
    return () => clearInterval(interval);
  }, [fetchMenuData]);

  // Cart operations
  const handleAddItem = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.id === item.id && ci.type === 'item');
      if (existing) {
        return prev.map(ci =>
          ci.id === item.id && ci.type === 'item' ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { id: item.id, type: 'item', item, quantity: 1 }];
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

  const handleAddCombo = (combo: Combo) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.id === combo.id && ci.type === 'combo');
      if (existing) {
        return prev.map(ci =>
          ci.id === combo.id && ci.type === 'combo' ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { id: combo.id, type: 'combo', combo, quantity: 1 }];
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

  const handleUpdateQuantity = (id: string, delta: number) => {
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

  const handleOrderSuccess = (newOrder: Order) => {
    setCart([]);
    setActiveOrders(prev => [newOrder, ...prev]);
  };

  const totalCartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);
  const totalCartPaise = cart.reduce((sum, ci) => {
    const price = ci.type === 'item' ? ci.item?.price_paise || 0 : ci.combo?.price_paise || 0;
    return sum + price * ci.quantity;
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-ink">
        <p className="font-serif text-lg text-ink-muted animate-pulse">
          Opening menu...
        </p>
      </div>
    );
  }

  if (error || !table) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-ink text-center">
        <div className="max-w-xs border border-rule p-6 bg-paper-card rounded-sm">
          <h2 className="font-serif text-lg font-bold text-chilli mb-2">
            Table not found
          </h2>
          <p className="text-xs text-ink-muted mb-4">
            {error || 'This QR code is invalid or has expired. Please ask the floor staff for a table card.'}
          </p>
          <a
            href="/"
            className="inline-block text-xs uppercase tracking-wider font-semibold text-ink border-b border-ink pb-0.5"
          >
            Restaurant Info
          </a>
        </div>
      </div>
    );
  }

  const filteredCombos = combos.filter(c => {
    if (filter === 'veg') return c.dietary === 'veg';
    if (filter === 'non_veg') return c.dietary === 'non_veg';
    return true;
  });

  return (
    <div className="min-h-screen bg-paper text-ink pb-24 max-w-lg mx-auto">
      {/* Top Printed Header */}
      <header className="px-4 pt-5 pb-3 border-b border-rule bg-paper sticky top-0 z-30">
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
              {table.table_number}
            </span>
          </div>
        </div>

        {/* Veg / Non-Veg Filters */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule/50 pt-2.5">
          <span className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
            Filter:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                filter === 'all'
                  ? 'bg-ink text-paper font-medium'
                  : 'border border-rule text-ink hover:bg-paper-subtle'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('veg')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-colors ${
                filter === 'veg'
                  ? 'bg-ink text-paper font-medium'
                  : 'border border-rule text-ink hover:bg-paper-subtle'
              }`}
            >
              <DietaryBadge type="veg" size="sm" />
              <span>Veg</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('non_veg')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-colors ${
                filter === 'non_veg'
                  ? 'bg-ink text-paper font-medium'
                  : 'border border-rule text-ink hover:bg-paper-subtle'
              }`}
            >
              <DietaryBadge type="non_veg" size="sm" />
              <span>Non-Veg</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Menu Body */}
      <main className="p-4">
        {/* Order tracking notification banner */}
        <OrderStatusBanner orders={activeOrders} />

        {/* Featured Combos / Thalis */}
        {filteredCombos.length > 0 && (
          <section className="mb-6">
            <h2 className="font-serif text-[11px] font-bold tracking-widest uppercase text-ink pb-1 border-b border-rule mb-2">
              Signature Combos & Thalis
            </h2>
            <div className="divide-y divide-rule/30">
              {filteredCombos.map(combo => {
                const inCart = cart.find(ci => ci.id === combo.id && ci.type === 'combo')?.quantity || 0;
                return (
                  <ComboItemRow
                    key={combo.id}
                    combo={combo}
                    quantityInCart={inCart}
                    onAdd={() => handleAddCombo(combo)}
                    onRemove={() => handleRemoveCombo(combo.id)}
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
            if (filter === 'veg') return item.dietary === 'veg';
            if (filter === 'non_veg') return item.dietary === 'non_veg';
            return true;
          });

          if (categoryItems.length === 0) return null;

          return (
            <section key={category.id} className="mb-6">
              <h2 className="font-serif text-[11px] font-bold tracking-widest uppercase text-ink pb-1 border-b border-rule mb-2">
                {category.name}
              </h2>
              <div>
                {categoryItems.map(item => {
                  const inCart = cart.find(ci => ci.id === item.id && ci.type === 'item')?.quantity || 0;
                  return (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      quantityInCart={inCart}
                      onAdd={() => handleAddItem(item)}
                      onRemove={() => handleRemoveItem(item.id)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Footer note */}
        <div className="text-center py-6 border-t border-rule/50 mt-8 text-[11px] text-ink-muted space-y-1">
          <p className="font-serif italic">Prepared fresh with pure desi ghee & spices</p>
          <p>Prices inclusive of local preparation &bull; GST applicable on billing</p>
        </div>
      </main>

      {/* Floating Cart Bar */}
      <CartBar
        itemCount={totalCartCount}
        totalPaise={totalCartPaise}
        onOpenReview={() => setIsReviewOpen(true)}
      />

      {/* Order Review & Placement Drawer */}
      <OrderDrawer
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        tableToken={token}
        tableNumber={table.table_number}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onOrderSuccess={handleOrderSuccess}
      />
    </div>
  );
}
