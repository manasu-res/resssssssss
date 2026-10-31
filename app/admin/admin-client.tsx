'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { formatRupees } from '@/lib/format';
import { DietaryBadge } from '@/components/ui/dietary-badge';
import type { StaffAuthResult } from '@/lib/auth/guard';
import { AdminReportsView } from '@/components/admin/admin-reports-view';

type AdminTab = 'menu' | 'combos' | 'tables' | 'staff' | 'settings' | 'reports';

interface CategoryItem {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number; // paise
  is_veg: boolean;
  is_available: boolean;
  sort_order: number;
}

interface ComboRow {
  id: string;
  name: string;
  description: string;
  price: number; // paise
  is_veg: boolean;
  is_available: boolean;
  items: Array<{
    menu_item_id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  separatePriceTotal: number;
}

interface DiningTableItem {
  id: string;
  label: string;
  qr_token: string;
  is_enabled: boolean;
  created_at: string;
}

interface StaffUserItem {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'waiter' | 'kitchen';
  is_active: boolean;
  created_at: string;
}

interface SettingsData {
  restaurant_name: string;
  address: string;
  phone: string;
  gstin: string | null;
  tax_percent: number;
  bill_footer: string;
}

interface AdminClientProps {
  staff: StaffAuthResult;
  initialTab?: AdminTab;
}

export default function AdminClient({ staff: currentOwner, initialTab = 'menu' }: AdminClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [loading, setLoading] = useState(true);

  // 1. Menu State
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  // Fast entry state per category: { [catId]: { name, priceRupees, isVeg } }
  const [fastEntry, setFastEntry] = useState<{
    [catId: string]: { name: string; priceRupees: string; isVeg: boolean };
  }>({});

  // Inline Price Editing State
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');

  // 2. Combos State
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [comboName, setComboName] = useState('');
  const [comboDescription, setComboDescription] = useState('');
  const [comboPriceRupees, setComboPriceRupees] = useState('');
  const [comboIsVeg, setComboIsVeg] = useState(true);
  const [comboSelectedItems, setComboSelectedItems] = useState<Array<{ menuItemId: string; quantity: number }>>([]);
  const [savingCombo, setSavingCombo] = useState(false);

  // 3. Tables State
  const [tables, setTables] = useState<DiningTableItem[]>([]);
  const [newTableLabel, setNewTableLabel] = useState('');
  const [isPrintAllOpen, setIsPrintAllOpen] = useState(false);
  const [qrImages, setQrImages] = useState<{ [tableId: string]: string }>({});

  // 4. Staff State
  const [staffList, setStaffList] = useState<StaffUserItem[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'kitchen' | 'owner'>('waiter');
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffMsg, setStaffMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // 5. Settings State
  const [settings, setSettings] = useState<SettingsData>({
    restaurant_name: 'Manasu Restaurant',
    address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    phone: '+91 80 2520 1980',
    gstin: '29AABCM8291Q1ZP',
    tax_percent: 0,
    bill_footer: 'Thank you for dining at Manasu! Visit again.',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const appBaseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  // Fetchers
  const fetchMenuData = useCallback(async () => {
    try {
      const [catRes, itemRes] = await Promise.all([
        fetch('/api/admin/categories'),
        fetch('/api/admin/menu-items'),
      ]);
      const catData = await catRes.json();
      const itemData = await itemRes.json();
      setCategories(catData.categories || []);
      setMenuItems(itemData.items || []);
    } catch (err) {
      console.error('Failed to load menu data:', err);
    }
  }, []);

  const fetchCombos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/combos');
      const data = await res.json();
      setCombos(data.combos || []);
    } catch (err) {
      console.error('Failed to load combos:', err);
    }
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tables');
      const data = await res.json();
      const tbls: DiningTableItem[] = data.tables || [];
      setTables(tbls);

      // Generate QR codes for all tables
      const qrMap: { [id: string]: string } = {};
      await Promise.all(
        tbls.map(async t => {
          const url = `${appBaseUrl}/t/${t.qr_token}`;
          qrMap[t.id] = await QRCode.toDataURL(url, {
            width: 200,
            margin: 1,
            color: { dark: '#1F1B16', light: '#FFFFFF' },
          });
        })
      );
      setQrImages(qrMap);
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  }, [appBaseUrl]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      setStaffList(data.staff || []);
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchMenuData(),
      fetchCombos(),
      fetchTables(),
      fetchStaff(),
      fetchSettings(),
    ]).finally(() => setLoading(false));
  }, [fetchMenuData, fetchCombos, fetchTables, fetchStaff, fetchSettings]);

  // ============================================================================
  // MENU OPERATIONS
  // ============================================================================
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          sortOrder: categories.length + 1,
        }),
      });
      if (res.ok) {
        setNewCategoryName('');
        fetchMenuData();
      }
    } catch (err) {
      console.error('Error adding category:', err);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const itemsInCat = menuItems.filter(i => i.category_id === id);
    if (itemsInCat.length > 0) {
      alert(`Cannot delete category "${name}" because it still has ${itemsInCat.length} items. Move or delete the items first.`);
      return;
    }
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchMenuData();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const handleUpdateCategoryName = async (id: string, name: string) => {
    try {
      await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });
      setEditingCategory(null);
      fetchMenuData();
    } catch (err) {
      console.error('Error updating category:', err);
    }
  };

  const handleToggleItemAvailability = async (id: string, current: boolean) => {
    try {
      await fetch('/api/admin/menu-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isAvailable: !current }),
      });
      fetchMenuData();
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" from the menu?`)) return;
    try {
      const res = await fetch(`/api/admin/menu-items?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchMenuData();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  // Inline Price Editing Handlers
  const handleStartEditPrice = (item: MenuItemRow) => {
    setEditingPriceItemId(item.id);
    const rupees = ((item.price || 0) / 100).toString();
    setEditingPriceValue(rupees);
  };

  const handleSavePrice = async (itemId: string) => {
    const rupees = parseFloat(editingPriceValue);
    if (isNaN(rupees) || rupees < 0) {
      alert('Please enter a valid price in rupees');
      return;
    }
    const pricePaise = Math.round(rupees * 100);

    // Optimistic UI update
    setMenuItems(prev => prev.map(i => (i.id === itemId ? { ...i, price: pricePaise } : i)));
    setEditingPriceItemId(null);

    try {
      const res = await fetch('/api/admin/menu-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, pricePaise }),
      });
      if (!res.ok) {
        fetchMenuData();
      }
    } catch (err) {
      console.error('Error updating price:', err);
      fetchMenuData();
    }
  };

  // Fast inline item creation at bottom of each category
  const handleFastAddSubmit = async (catId: string) => {
    const entry = fastEntry[catId];
    if (!entry || !entry.name.trim() || !entry.priceRupees) return;

    const pricePaise = Math.round((parseFloat(entry.priceRupees) || 0) * 100);
    if (pricePaise <= 0) return;

    try {
      const res = await fetch('/api/admin/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: catId,
          name: entry.name.trim(),
          description: '',
          pricePaise,
          isVeg: entry.isVeg ?? true,
          isAvailable: true,
          sortOrder: menuItems.filter(i => i.category_id === catId).length + 1,
        }),
      });

      if (res.ok) {
        // Clear entry for this category and keep isVeg preference
        setFastEntry(prev => ({
          ...prev,
          [catId]: { name: '', priceRupees: '', isVeg: entry.isVeg ?? true },
        }));
        fetchMenuData();
      }
    } catch (err) {
      console.error('Fast add failed:', err);
    }
  };

  // ============================================================================
  // COMBOS OPERATIONS
  // ============================================================================
  const handleAddComboItem = (menuItemId: string) => {
    setComboSelectedItems(prev => {
      const exist = prev.find(i => i.menuItemId === menuItemId);
      if (exist) {
        return prev.map(i =>
          i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { menuItemId, quantity: 1 }];
    });
  };

  const handleRemoveComboItem = (menuItemId: string) => {
    setComboSelectedItems(prev => prev.filter(i => i.menuItemId !== menuItemId));
  };

  const handleUpdateComboItemQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveComboItem(menuItemId);
      return;
    }
    setComboSelectedItems(prev =>
      prev.map(i => (i.menuItemId === menuItemId ? { ...i, quantity: qty } : i))
    );
  };

  const currentComboSeparatePrice = comboSelectedItems.reduce((sum, ci) => {
    const it = menuItems.find(m => m.id === ci.menuItemId);
    return sum + (it?.price || 0) * ci.quantity;
  }, 0);

  const handleSaveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comboName.trim() || !comboPriceRupees || comboSelectedItems.length === 0) {
      alert('Please enter a combo name, price, and select at least one item.');
      return;
    }

    setSavingCombo(true);
    try {
      const pricePaise = Math.round((parseFloat(comboPriceRupees) || 0) * 100);
      const res = await fetch('/api/admin/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: comboName.trim(),
          description: comboDescription.trim(),
          pricePaise,
          isVeg: comboIsVeg,
          items: comboSelectedItems,
        }),
      });

      if (res.ok) {
        setComboName('');
        setComboDescription('');
        setComboPriceRupees('');
        setComboSelectedItems([]);
        fetchCombos();
      }
    } catch (err) {
      console.error('Error saving combo:', err);
    } finally {
      setSavingCombo(false);
    }
  };

  const handleDeleteCombo = async (id: string, name: string) => {
    if (!confirm(`Delete combo "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/combos?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchCombos();
    } catch (err) {
      console.error('Error deleting combo:', err);
    }
  };

  // ============================================================================
  // TABLES OPERATIONS
  // ============================================================================
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) return;
    try {
      const res = await fetch('/api/admin/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newTableLabel.trim() }),
      });
      if (res.ok) {
        setNewTableLabel('');
        fetchTables();
      }
    } catch (err) {
      console.error('Error adding table:', err);
    }
  };

  const handleResetQr = async (id: string, label: string) => {
    if (!confirm(`Reset QR code for ${label}? Any previously printed card for this table will stop working immediately.`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/tables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reset_qr' }),
      });
      if (res.ok) fetchTables();
    } catch (err) {
      console.error('Error resetting table QR:', err);
    }
  };

  const handleDownloadQrPng = (table: DiningTableItem) => {
    const dataUrl = qrImages[table.id];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `manasu-${table.label.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
    a.click();
  };

  // ============================================================================
  // STAFF OPERATIONS
  // ============================================================================
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStaff(true);
    setStaffMsg(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          password: newStaffPassword,
          role: newStaffRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create staff');

      setStaffMsg({ type: 'success', text: `Staff account created for ${newStaffName}` });
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffRole('waiter');
      fetchStaff();
    } catch (err: any) {
      setStaffMsg({ type: 'error', text: err.message || 'Error creating staff' });
    } finally {
      setSavingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: !currentStatus }),
      });
      if (res.ok) {
        fetchStaff();
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          alert('Session switched or expired. If you logged in as Waiter/Kitchen in another tab, please Sign out and log back in as Owner.');
        } else {
          alert(data.error || 'Failed to update status');
        }
      }
    } catch (err) {
      console.error('Error toggling staff status:', err);
    }
  };

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSettingsMsg('Settings saved successfully.');
      } else {
        const data = await res.json();
        setSettingsMsg(data.error || 'Failed to save settings.');
      }
    } catch (err) {
      setSettingsMsg('Network error while saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col md:flex-row font-sans">
      {/* Print All Tables Sheet (visible only during window.print()) */}
      <div id="print-all-tables" className="hidden print:block font-mono p-4">
        <div className="grid grid-cols-2 gap-8">
          {tables.map(tbl => (
            <div
              key={tbl.id}
              className="border-2 border-black p-6 text-center flex flex-col items-center justify-between min-h-[300px] break-inside-avoid"
            >
              <div className="text-xs font-bold tracking-widest uppercase">
                {settings.restaurant_name}
              </div>
              <div className="text-3xl font-serif font-black my-2">
                Table {tbl.label}
              </div>
              {qrImages[tbl.id] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrImages[tbl.id]}
                  alt={`QR for ${tbl.label}`}
                  className="w-44 h-44 border border-black my-2"
                />
              )}
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider mt-1">
                Scan to order
              </div>
              <div className="text-[9px] text-neutral-600 font-mono mt-0.5">
                {appBaseUrl}/t/{tbl.qr_token}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Top Header (Visible on < md) */}
      <header className="md:hidden bg-paper-card border-b border-rule px-4 py-2.5 flex items-center justify-between shrink-0 print:hidden">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-ink-muted block">
            MANASU RESTAURANT
          </span>
          <h1 className="font-serif text-base font-bold text-ink leading-tight">
            Admin &middot; <span className="font-sans font-normal text-xs text-ink-muted">{currentOwner.name}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1 text-xs text-chilli font-semibold border border-chilli/40 bg-white rounded-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile Horizontal Tabs Navigation (Thumb-friendly 40px targets, scrollable) */}
      <nav aria-label="Admin tabs" className="md:hidden bg-paper-subtle border-b border-rule px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 print:hidden">
        {(['menu', 'combos', 'tables', 'staff', 'settings', 'reports'] as AdminTab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[40px] px-3.5 text-xs font-semibold uppercase tracking-wider rounded-sm shrink-0 transition-colors ${
              tab === t ? 'bg-ink text-paper' : 'border border-rule bg-white text-ink hover:bg-paper'
            }`}
          >
            {t === 'menu' ? 'Menu' : t === 'combos' ? `Combos (${combos.length})` : t === 'tables' ? `Tables (${tables.length})` : t === 'staff' ? `Staff (${staffList.length})` : t === 'settings' ? 'Settings' : 'Reports'}
          </button>
        ))}
      </nav>

      {/* Left Sidebar - Fixed on Desktop (md: and above) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 bg-paper-card border-r border-rule flex-col shrink-0 h-screen sticky top-0 print:hidden">
        <div className="p-4 border-b border-rule">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-ink-muted block">
            MANASU RESTAURANT
          </span>
          <h1 className="font-serif text-lg font-bold text-ink">
            Admin
          </h1>
          <span className="text-[11px] text-ink-muted">
            {currentOwner.name}
          </span>
        </div>

        <nav className="p-2 space-y-1 flex-1">
          <button
            type="button"
            onClick={() => setTab('menu')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'menu' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => setTab('combos')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'combos' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Combos ({combos.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('tables')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'tables' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Tables ({tables.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('staff')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'staff' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Staff ({staffList.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'settings' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'reports' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Reports
          </button>
        </nav>

        <div className="p-3 border-t border-rule space-y-1.5">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-center text-xs py-1 text-chilli hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-y-auto print:hidden">
        {loading ? (
          <p className="py-12 text-center text-xs text-ink-muted">Loading...</p>
        ) : tab === 'menu' ? (
          /* ================================================================ */
          /* 1. MENU MANAGEMENT: CATEGORIES & FAST ENTRY ITEMS                */
          /* ================================================================ */
          <div className="space-y-6 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-3">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink">
                  Menu Management
                </h2>
                <p className="text-xs text-ink-muted">
                  Categories and dishes. Toggle availability with 1 tap. Use the quick-add row at the bottom of any category.
                </p>
              </div>

              {/* Add Category Form */}
              <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="h-9 px-3 text-xs border border-rule rounded-sm bg-white text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
                />
                <button
                  type="submit"
                  className="h-9 px-3 bg-ink text-paper text-xs font-semibold rounded-sm hover:bg-black whitespace-nowrap cursor-pointer"
                >
                  + Add Category
                </button>
              </form>
            </div>

            {/* Category Groups with Table & Fast Entry Row */}
            <div className="space-y-8">
              {categories.map(cat => {
                const catItems = menuItems.filter(i => i.category_id === cat.id);
                const curFast = fastEntry[cat.id] || { name: '', priceRupees: '', isVeg: true };

                return (
                  <div key={cat.id} className="border border-rule bg-white rounded-sm overflow-hidden">
                    {/* Category Header */}
                    <div className="px-4 py-2.5 bg-paper-card border-b border-rule flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {editingCategory?.id === cat.id ? (
                          <input
                            type="text"
                            defaultValue={cat.name}
                            onBlur={e => handleUpdateCategoryName(cat.id, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handleUpdateCategoryName(cat.id, (e.target as HTMLInputElement).value);
                              }
                            }}
                            autoFocus
                            className="text-xs font-bold px-2 py-1 border border-ink bg-white rounded-sm"
                          />
                        ) : (
                          <h3
                            onClick={() => setEditingCategory(cat)}
                            className="font-serif text-sm font-bold text-ink cursor-pointer hover:underline"
                            title="Click to rename category"
                          >
                            {cat.name}
                          </h3>
                        )}
                        <span className="text-[11px] text-ink-muted">
                          ({catItems.length} {catItems.length === 1 ? 'item' : 'items'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCategory(cat)}
                          className="text-[11px] text-ink-muted hover:text-ink"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="text-[11px] text-chilli hover:underline"
                        >
                          Delete Category
                        </button>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                      <thead className="bg-paper-subtle border-b border-rule text-ink-muted uppercase text-[10px] font-semibold">
                        <tr>
                          <th className="px-4 py-2 w-8">Type</th>
                          <th className="px-4 py-2">Item Name</th>
                          <th className="px-4 py-2 text-right">Price</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rule/50">
                        {catItems.map(item => (
                          <tr key={item.id} className="hover:bg-paper-subtle/40">
                            <td className="px-4 py-2.5">
                              <DietaryBadge type={item.is_veg ? 'veg' : 'non_veg'} size="sm" />
                            </td>
                            <td className="px-4 py-2.5 font-medium text-ink">
                              {item.name}
                              {item.description && (
                                <span className="block text-[11px] text-ink-muted truncate max-w-sm">
                                  {item.description}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-bold tabular-nums">
                              {editingPriceItemId === item.id ? (
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <span className="text-xs text-ink-muted">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    autoFocus
                                    value={editingPriceValue}
                                    onChange={e => setEditingPriceValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSavePrice(item.id);
                                      if (e.key === 'Escape') setEditingPriceItemId(null);
                                    }}
                                    className="w-16 px-1.5 py-0.5 text-xs border border-ink rounded-sm bg-white text-right font-bold focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePrice(item.id)}
                                    className="px-2 py-0.5 text-[10px] bg-ink text-paper rounded-sm font-bold uppercase hover:bg-ink/90 cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingPriceItemId(null)}
                                    className="px-1 text-xs text-ink-muted hover:text-ink cursor-pointer font-bold"
                                    title="Cancel"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPrice(item)}
                                  className="inline-flex items-center gap-1 hover:text-chilli cursor-pointer group"
                                  title="Click to edit price"
                                >
                                  <span>{formatRupees(item.price)}</span>
                                  <span className="text-[10px] text-ink-muted font-normal underline group-hover:text-chilli">
                                    Edit
                                  </span>
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {/* 1-tap "sold out" toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleItemAvailability(item.id, item.is_available)}
                                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase transition-colors ${
                                  item.is_available
                                    ? 'bg-green-100 text-green-900 border border-green-300 hover:bg-green-200'
                                    : 'bg-red-100 text-red-900 border border-red-300 hover:bg-red-200'
                                }`}
                              >
                                {item.is_available ? 'Available' : 'Sold Out'}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditPrice(item)}
                                className="text-[11px] text-ink hover:underline font-semibold"
                              >
                                Edit price
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id, item.name)}
                                className="text-[11px] text-chilli hover:underline"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* FAST ENTRY ROW AT BOTTOM OF CATEGORY (Works with Keyboard Enter) */}
                        <tr className="bg-paper-subtle/70 border-t border-rule font-sans">
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFastEntry(prev => ({
                                  ...prev,
                                  [cat.id]: { ...curFast, isVeg: !curFast.isVeg },
                                }));
                              }}
                              className="focus:outline-none"
                              title="Toggle Veg/Non-Veg"
                            >
                              <DietaryBadge type={curFast.isVeg ? 'veg' : 'non_veg'} size="sm" />
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={curFast.name}
                              onChange={e => {
                                const val = e.target.value;
                                setFastEntry(prev => ({
                                  ...prev,
                                  [cat.id]: { ...curFast, name: val },
                                }));
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleFastAddSubmit(cat.id);
                                }
                              }}
                              placeholder="New dish name (press Enter to save)"
                              className="w-full text-xs px-2.5 py-1 border border-rule rounded-sm bg-white text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={curFast.priceRupees}
                              onChange={e => {
                                const val = e.target.value;
                                setFastEntry(prev => ({
                                  ...prev,
                                  [cat.id]: { ...curFast, priceRupees: val },
                                }));
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleFastAddSubmit(cat.id);
                                }
                              }}
                              placeholder="₹ Price"
                              className="w-20 text-right text-xs px-2 py-1 border border-rule rounded-sm bg-white text-ink font-mono focus:outline-none focus:border-ink"
                            />
                          </td>
                          <td colSpan={2} className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleFastAddSubmit(cat.id)}
                              className="h-7 px-3 bg-ink text-paper text-[11px] font-semibold rounded-sm hover:bg-black"
                            >
                              Add (↵)
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tab === 'combos' ? (
          /* ================================================================ */
          /* 2. COMBOS MANAGEMENT                                             */
          /* ================================================================ */
          <div className="space-y-6 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-full">
            <div className="border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-bold text-ink">
                Combos &amp; Thalis
              </h2>
              <p className="text-xs text-ink-muted">
                Group menu items into cost-effective combos. Compare the combo price against separate item prices to view savings.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
              {/* Create Combo Form */}
              <form onSubmit={handleSaveCombo} className="border border-rule bg-white p-4 rounded-sm space-y-4">
              <span className="block text-xs uppercase tracking-wider font-bold text-ink border-b border-rule pb-2">
                Create New Combo
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Combo Name
                  </label>
                  <input
                    type="text"
                    required
                    value={comboName}
                    onChange={e => setComboName(e.target.value)}
                    placeholder="e.g. South Bengaluru Breakfast Combo"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white focus:outline-none focus:border-ink"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Combo Price (₹ Rupees)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={comboPriceRupees}
                    onChange={e => setComboPriceRupees(e.target.value)}
                    placeholder="e.g. 110"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white font-mono focus:outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={comboDescription}
                  onChange={e => setComboDescription(e.target.value)}
                  placeholder="e.g. 1 Thatte Idli with Vada paired with hot authentic Degree Filter Coffee"
                  className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white focus:outline-none focus:border-ink"
                />
              </div>

              {/* Items Picker for Combo */}
              <div className="border border-rule/70 p-3 bg-paper-subtle/50 rounded-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-bold text-ink">
                    Select Items Included in this Combo
                  </span>
                  <div className="text-xs font-semibold text-ink">
                    Separate Total: {formatRupees(currentComboSeparatePrice)}
                    {parseFloat(comboPriceRupees) > 0 && currentComboSeparatePrice > 0 && (
                      <span className="ml-2 text-green-800">
                        (Customer saves {formatRupees(Math.max(0, currentComboSeparatePrice - (parseFloat(comboPriceRupees) * 100)))})
                      </span>
                    )}
                  </div>
                </div>

                {/* Selected combo items pills */}
                {comboSelectedItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 py-2">
                    {comboSelectedItems.map(ci => {
                      const it = menuItems.find(m => m.id === ci.menuItemId);
                      return (
                        <div
                          key={ci.menuItemId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-rule rounded-sm text-xs font-medium"
                        >
                          <DietaryBadge type={it?.is_veg ? 'veg' : 'non_veg'} size="sm" />
                          <span>{it?.name}</span>
                          <span className="text-ink-muted">({formatRupees((it?.price || 0) * ci.quantity)})</span>
                          <div className="flex items-center gap-0.5 ml-1 border-l border-rule pl-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateComboItemQty(ci.menuItemId, ci.quantity - 1)}
                              className="w-4 h-4 text-xs font-bold flex items-center justify-center hover:bg-paper-subtle"
                            >
                              -
                            </button>
                            <span className="px-1 text-[11px] font-bold">{ci.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateComboItemQty(ci.menuItemId, ci.quantity + 1)}
                              className="w-4 h-4 text-xs font-bold flex items-center justify-center hover:bg-paper-subtle"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveComboItem(ci.menuItemId)}
                            className="text-chilli font-bold ml-1 hover:text-chilli-hover"
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available menu items dropdown / list */}
                <div className="flex items-center gap-2 pt-1">
                  <select
                    id="combo-item-selector"
                    className="text-xs px-2.5 py-1.5 border border-rule rounded-sm bg-white text-ink flex-1"
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) {
                        handleAddComboItem(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="" disabled>+ Choose dish to include in combo...</option>
                    {menuItems.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {formatRupees(m.price)} ({m.is_veg ? 'Veg' : 'Non-Veg'})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={comboIsVeg}
                        onChange={() => setComboIsVeg(true)}
                      />
                      <span>Veg</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={!comboIsVeg}
                        onChange={() => setComboIsVeg(false)}
                      />
                      <span>Non-Veg</span>
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCombo}
                className="h-9 px-4 bg-ink text-paper text-xs font-bold uppercase rounded-sm hover:bg-black"
              >
                {savingCombo ? 'Saving...' : 'Save Combo'}
              </button>
            </form>

            {/* Combos Table */}
            <div className="border border-rule bg-white rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                <thead className="bg-paper-card border-b border-rule text-ink-muted uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-2">Combo</th>
                    <th className="px-4 py-2">Included Items</th>
                    <th className="px-4 py-2 text-right">Price / Separate</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/50">
                  {combos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                        No combos created yet. Add one above.
                      </td>
                    </tr>
                  ) : (
                    combos.map(combo => {
                      const savings = Math.max(0, combo.separatePriceTotal - combo.price);
                      return (
                        <tr key={combo.id} className="hover:bg-paper-subtle/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <DietaryBadge type={combo.is_veg ? 'veg' : 'non_veg'} size="sm" />
                              <span className="font-bold text-ink">{combo.name}</span>
                            </div>
                            {combo.description && (
                              <span className="block text-[11px] text-ink-muted mt-0.5">
                                {combo.description}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ul className="space-y-0.5 text-[11px] text-ink-muted">
                              {combo.items.map((it, idx) => (
                                <li key={idx}>
                                  {it.quantity}&times; {it.name} ({formatRupees(it.price * it.quantity)})
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-bold text-ink tabular-nums text-sm">
                              {formatRupees(combo.price)}
                            </div>
                            <div className="text-[10px] text-ink-muted tabular-nums">
                              Separate: {formatRupees(combo.separatePriceTotal)}
                            </div>
                            {savings > 0 && (
                              <div className="text-[10px] font-bold text-green-800">
                                Save {formatRupees(savings)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteCombo(combo.id, combo.name)}
                              className="text-[11px] text-chilli hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
            </div>
          </div>
        ) : tab === 'tables' ? (
          /* ================================================================ */
          /* 3. TABLES & QR CODES MANAGEMENT                                  */
          /* ================================================================ */
          <div className="space-y-6 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-3">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink">
                  Dining Tables &amp; QR Codes
                </h2>
                <p className="text-xs text-ink-muted">
                  Add tables, download individual QR code images, reset tokens when cards are replaced, or print tabletop cards.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {tables.length > 0 && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-9 px-3 border border-ink text-ink text-xs font-semibold rounded-sm hover:bg-paper-subtle cursor-pointer"
                  >
                    Print All QR Codes
                  </button>
                )}
              </div>
            </div>

            {/* Add Table Form */}
            <form onSubmit={handleAddTable} className="border border-rule bg-white p-4 rounded-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <span className="text-xs uppercase tracking-wider font-bold text-ink shrink-0">
                Add Table:
              </span>
              <input
                type="text"
                required
                value={newTableLabel}
                onChange={e => setNewTableLabel(e.target.value)}
                placeholder="Table label (e.g. 1, 2, Garden-1)"
                className="h-9 px-3 text-xs border border-rule rounded-sm bg-white text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink flex-1"
              />
              <button
                type="submit"
                className="h-9 px-4 bg-ink text-paper text-xs font-semibold rounded-sm hover:bg-black shrink-0 cursor-pointer"
              >
                + Add Table
              </button>
            </form>

            {/* Tables List */}
            <div className="border border-rule bg-white rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-paper-card border-b border-rule text-ink-muted uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="px-4 py-2 w-20">Table</th>
                      <th className="px-4 py-2">QR Code Preview</th>
                      <th className="px-4 py-2">Target Customer URL</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/50">
                    {tables.map(tbl => {
                      const tableUrl = `${appBaseUrl}/t/${tbl.qr_token}`;
                      return (
                        <tr key={tbl.id} className="hover:bg-paper-subtle/40">
                          <td className="px-4 py-3 font-serif font-bold text-base text-ink">
                            {tbl.label}
                          </td>
                          <td className="px-4 py-3">
                            {qrImages[tbl.id] ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={qrImages[tbl.id]}
                                alt={`QR for ${tbl.label}`}
                                className="w-16 h-16 border border-rule rounded-sm"
                              />
                            ) : (
                              <span className="text-xs text-ink-muted">Generating...</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-ink-muted break-all">
                            <a
                              href={`/t/${tbl.qr_token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-ink hover:underline font-semibold"
                            >
                              {tableUrl}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadQrPng(tbl)}
                              className="h-7 px-2.5 border border-rule text-xs font-semibold rounded-sm hover:bg-paper-subtle"
                            >
                              Download QR
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetQr(tbl.id, tbl.label)}
                              className="h-7 px-2.5 border border-rule hover:border-chilli text-xs font-semibold rounded-sm text-chilli hover:bg-chilli-light"
                            >
                              Reset QR
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : tab === 'staff' ? (
          /* ================================================================ */
          /* 4. STAFF MANAGEMENT                                              */
          /* ================================================================ */
          <div className="space-y-6 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-full">
            <div className="border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-bold text-ink">
                Staff Accounts
              </h2>
              <p className="text-xs text-ink-muted">
                Create accounts for floor waiters, kitchen staff, or owners. Deactivate staff when needed.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
              {/* Create Staff Form */}
              <form onSubmit={handleCreateStaff} className="border border-rule bg-white p-4 rounded-sm space-y-3">
              <span className="block text-xs uppercase tracking-wider font-bold text-ink border-b border-rule pb-2">
                Create Staff Account
              </span>

              {staffMsg && (
                <div
                  className={`p-2.5 text-xs rounded-sm border ${
                    staffMsg.type === 'error'
                      ? 'bg-chilli/10 border-chilli text-chilli'
                      : 'bg-green-50 border-green-600 text-green-900'
                  }`}
                >
                  {staffMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Staff Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaffName}
                    onChange={e => setNewStaffName(e.target.value)}
                    placeholder="e.g. Ramesh Gowda"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Login Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={e => setNewStaffEmail(e.target.value)}
                    placeholder="ramesh@manasu.com"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newStaffPassword}
                    onChange={e => setNewStaffPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Role
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={e => setNewStaffRole(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white"
                  >
                    <option value="waiter">Waiter (Floor POS)</option>
                    <option value="kitchen">Kitchen (KDS)</option>
                    <option value="owner">Owner (Admin)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingStaff}
                className="h-9 px-4 bg-ink text-paper text-xs font-bold uppercase rounded-sm hover:bg-black mt-2"
              >
                {savingStaff ? 'Creating...' : 'Create Account'}
              </button>
            </form>

            {/* Staff Table */}
            <div className="border border-rule bg-white rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-paper-card border-b border-rule text-ink-muted uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2 text-center">Status</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/50">
                    {staffList.map(st => {
                      const isSelf = st.id === currentOwner.userId;
                      return (
                        <tr key={st.id} className="hover:bg-paper-subtle/50">
                          <td className="px-4 py-2.5 font-medium text-ink">
                            {st.name} {isSelf && <span className="text-[10px] text-ink-muted font-normal">(You)</span>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-ink-muted">
                            {st.email || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded-sm bg-paper-card border border-rule">
                              {st.role}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded-sm font-semibold uppercase text-[10px] ${
                                st.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {st.is_active ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleToggleStaffStatus(st.id, st.is_active)}
                                className={`text-xs font-semibold hover:underline ${
                                  st.is_active ? 'text-chilli' : 'text-green-800'
                                }`}
                              >
                                {st.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        ) : tab === 'settings' ? (
          /* ================================================================ */
          /* 5. RESTAURANT SETTINGS                                           */
          /* ================================================================ */
          <div className="space-y-6 w-full max-w-4xl">
            <div className="border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-bold text-ink">
                Restaurant Settings
              </h2>
              <p className="text-xs text-ink-muted">
                These details appear on printed thermal receipts, bill headers, and customer order screens.
              </p>
            </div>

            {settingsMsg && (
              <div className="p-3 bg-paper-card border border-rule text-xs rounded-sm text-ink font-semibold">
                {settingsMsg}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="border border-rule bg-white p-5 rounded-sm space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  required
                  value={settings.restaurant_name}
                  onChange={e => setSettings({ ...settings, restaurant_name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-rule rounded-sm text-ink bg-white focus:outline-none focus:border-ink font-serif font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
                  Full Address (Appears on Receipt)
                </label>
                <input
                  type="text"
                  required
                  value={settings.address}
                  onChange={e => setSettings({ ...settings, address: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-rule rounded-sm text-ink bg-white focus:outline-none focus:border-ink"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.phone}
                    onChange={e => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-rule rounded-sm text-ink bg-white focus:outline-none focus:border-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={settings.gstin || ''}
                    onChange={e => setSettings({ ...settings, gstin: e.target.value })}
                    placeholder="29AABCM8291Q1ZP"
                    className="w-full text-xs px-3 py-2 border border-rule rounded-sm text-ink bg-white font-mono focus:outline-none focus:border-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Tax Percent (GST %)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={settings.tax_percent}
                    onChange={e => setSettings({ ...settings, tax_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-3 py-2 border border-rule rounded-sm text-ink bg-white font-mono focus:outline-none focus:border-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Bill Footer Note
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.bill_footer}
                    onChange={e => setSettings({ ...settings, bill_footer: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-rule rounded-sm text-ink bg-white focus:outline-none focus:border-ink"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="h-10 px-5 bg-ink text-paper text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-black mt-2"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        ) : tab === 'reports' ? (
          <AdminReportsView />
        ) : null}
      </main>
    </div>
  );
}
