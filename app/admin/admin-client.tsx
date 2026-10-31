'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MenuItem, MenuCategory, RestaurantTable } from '@/lib/types';
import { formatRupees } from '@/lib/format';
import { DietaryBadge } from '@/components/ui/dietary-badge';
import { TableQrCard } from '@/components/admin/table-qr-card';
import type { StaffAuthResult } from '@/lib/auth/guard';

type AdminTab = 'reports' | 'menu' | 'tables' | 'staff';

interface StaffUserItem {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'waiter' | 'kitchen';
  is_active: boolean;
  created_at: string;
}

interface AdminClientProps {
  staff: StaffAuthResult;
}

export default function AdminClient({ staff: currentOwner }: AdminClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('reports');
  const [loading, setLoading] = useState(true);

  // Overview / Reports
  const [overview, setOverview] = useState<any>(null);

  // Menu
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemPriceRupees, setItemPriceRupees] = useState('');
  const [itemDietary, setItemDietary] = useState<'veg' | 'non_veg'>('veg');
  const [itemDescription, setItemDescription] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [savingItem, setSavingItem] = useState(false);

  // Tables
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedQrTable, setSelectedQrTable] = useState<RestaurantTable | null>(null);

  // Staff Management State
  const [staffList, setStaffList] = useState<StaffUserItem[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'kitchen' | 'owner'>('waiter');
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error('Error fetching admin overview:', err);
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/menu');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setItems(data.items || []);
        if (data.categories?.length > 0 && !itemCategoryId) {
          setItemCategoryId(data.categories[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
    }
  }, [itemCategoryId]);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/waiter/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff');
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } catch (err) {
      console.error('Error fetching staff list:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchOverview(), fetchMenu(), fetchTables(), fetchStaff()]).finally(() => {
      setLoading(false);
    });
  }, [fetchOverview, fetchMenu, fetchTables, fetchStaff]);

  // Menu Save
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingItem(true);
    try {
      const pricePaise = Math.round((parseFloat(itemPriceRupees) || 0) * 100);
      const payload = {
        id: editingItem?.id,
        categoryId: itemCategoryId,
        name: itemName.trim(),
        description: itemDescription.trim(),
        pricePaise,
        dietary: itemDietary,
        isAvailable: itemAvailable,
        sortOrder: editingItem?.sort_order || items.length + 1,
      };

      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingItem(null);
        setItemName('');
        setItemPriceRupees('');
        setItemDescription('');
        setItemDietary('veg');
        setItemAvailable(true);
        fetchMenu();
      }
    } catch (err) {
      console.error('Error saving item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  const handleEditClick = (it: MenuItem) => {
    setEditingItem(it);
    setItemName(it.name);
    setItemCategoryId(it.category_id);
    setItemPriceRupees((it.price_paise / 100).toString());
    setItemDietary(it.dietary);
    setItemDescription(it.description);
    setItemAvailable(it.is_available);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setItemName('');
    setItemPriceRupees('');
    setItemDescription('');
    setItemDietary('veg');
    setItemAvailable(true);
  };

  // Staff Creation
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStaff(true);
    setStaffError(null);
    setStaffSuccess(null);

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
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff account');
      }

      setStaffSuccess(`Staff account created for ${newStaffName}`);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffRole('waiter');
      fetchStaff();
    } catch (err: any) {
      setStaffError(err.message || 'Error creating staff');
    } finally {
      setSavingStaff(false);
    }
  };

  // Toggle Staff Active Status
  const handleToggleStaffStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          isActive: !currentStatus,
        }),
      });

      if (res.ok) {
        fetchStaff();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error toggling staff status:', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col md:flex-row font-sans">
      {/* Plain Left Sidebar - No Fluff */}
      <aside className="w-full md:w-56 bg-paper-card border-r border-rule flex flex-col shrink-0">
        <div className="p-4 border-b border-rule">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-ink-muted block">
            MANASU RESTAURANT
          </span>
          <h1 className="font-serif text-lg font-bold text-ink">
            Admin Portal
          </h1>
          <span className="text-[11px] text-ink-muted">
            {currentOwner.name}
          </span>
        </div>

        <nav className="p-2 space-y-1 flex-1">
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'reports' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Overview & Reports
          </button>
          <button
            type="button"
            onClick={() => setTab('menu')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'menu' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Menu Management
          </button>
          <button
            type="button"
            onClick={() => setTab('tables')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'tables' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Tables & QR Codes
          </button>
          <button
            type="button"
            onClick={() => setTab('staff')}
            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-sm transition-colors ${
              tab === 'staff' ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-subtle'
            }`}
          >
            Staff Accounts ({staffList.length})
          </button>
        </nav>

        <div className="p-3 border-t border-rule space-y-1">
          <a
            href="/waiter"
            className="block text-center text-xs py-1.5 border border-rule bg-white text-ink rounded-sm hover:bg-paper-subtle"
          >
            Floor POS &rarr;
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-center text-xs py-1.5 text-chilli hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Plain Tables and Forms Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <p className="py-12 text-center text-xs text-ink-muted">Loading admin...</p>
        ) : tab === 'reports' ? (
          /* SECTION 1: REPORTS & REVENUE OVERVIEW */
          <div className="space-y-6 max-w-4xl">
            <div className="border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-bold text-ink">
                Sales & Performance Overview
              </h2>
              <p className="text-xs text-ink-muted">
                Financial performance and ordering metrics.
              </p>
            </div>

            {/* Metric Boxes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 border border-rule bg-white rounded-sm">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block">
                  Total Revenue
                </span>
                <span className="font-serif text-xl font-bold text-ink tabular-nums mt-1 block">
                  {formatRupees(overview?.totalRevenuePaise || 0)}
                </span>
              </div>
              <div className="p-3 border border-rule bg-white rounded-sm">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block">
                  Bills Settled
                </span>
                <span className="font-serif text-xl font-bold text-ink tabular-nums mt-1 block">
                  {overview?.settledBillsCount || 0}
                </span>
              </div>
              <div className="p-3 border border-rule bg-white rounded-sm">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block">
                  Total Orders
                </span>
                <span className="font-serif text-xl font-bold text-ink tabular-nums mt-1 block">
                  {overview?.totalOrdersCount || 0}
                </span>
              </div>
              <div className="p-3 border border-rule bg-white rounded-sm">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold block">
                  Avg Bill Value
                </span>
                <span className="font-serif text-xl font-bold text-ink tabular-nums mt-1 block">
                  {overview?.settledBillsCount > 0
                    ? formatRupees(Math.round(overview.totalRevenuePaise / overview.settledBillsCount))
                    : '₹0'}
                </span>
              </div>
            </div>

            {/* Payment Method Split */}
            <div className="border border-rule bg-white p-4 rounded-sm">
              <h3 className="text-xs uppercase tracking-wider font-bold text-ink mb-3">
                Payment Channel Breakdown
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center divide-x divide-rule">
                <div>
                  <span className="text-[11px] text-ink-muted uppercase">UPI</span>
                  <span className="font-bold text-sm block mt-0.5 tabular-nums">
                    {formatRupees(overview?.breakdown?.upiPaise || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-muted uppercase">Cash</span>
                  <span className="font-bold text-sm block mt-0.5 tabular-nums">
                    {formatRupees(overview?.breakdown?.cashPaise || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-muted uppercase">Card</span>
                  <span className="font-bold text-sm block mt-0.5 tabular-nums">
                    {formatRupees(overview?.breakdown?.cardPaise || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Selling Dishes Table */}
            <div className="border border-rule bg-white rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-rule bg-paper-subtle">
                <h3 className="text-xs uppercase tracking-wider font-bold text-ink">
                  Top Selling Bengaluru Dishes
                </h3>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-paper-card border-b border-rule text-ink-muted font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2">Item Name</th>
                    <th className="px-4 py-2 text-center">Units Sold</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/50">
                  {overview?.topItems?.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-ink-muted">
                        No orders registered yet.
                      </td>
                    </tr>
                  ) : (
                    overview?.topItems?.map((ti: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-medium">{ti.name}</td>
                        <td className="px-4 py-2.5 text-center font-bold tabular-nums">{ti.count}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                          {formatRupees(ti.revenuePaise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'menu' ? (
          /* SECTION 2: MENU MANAGEMENT */
          <div className="space-y-6 max-w-4xl">
            <div className="border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-bold text-ink">
                Menu Management
              </h2>
              <p className="text-xs text-ink-muted">
                Add, edit, change prices, and toggle dish availability.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveItem} className="border border-rule bg-white p-4 rounded-sm space-y-3">
              <div className="flex items-center justify-between border-b border-rule pb-2">
                <span className="text-xs uppercase tracking-wider font-bold text-ink">
                  {editingItem ? 'Edit Dish' : 'Add New Dish to Menu'}
                </span>
                {editingItem && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs text-ink-muted underline"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    placeholder="e.g. Set Dosa with Vada"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Category
                  </label>
                  <select
                    value={itemCategoryId}
                    onChange={e => setItemCategoryId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={itemPriceRupees}
                    onChange={e => setItemPriceRupees(e.target.value)}
                    placeholder="e.g. 95"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-muted mb-1">
                    One-line Description
                  </label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={e => setItemDescription(e.target.value)}
                    placeholder="Crisp butter dosa served with spicy potato palya and fresh coconut chutney"
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name="dietary"
                      checked={itemDietary === 'veg'}
                      onChange={() => setItemDietary('veg')}
                    />
                    <span>Veg</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name="dietary"
                      checked={itemDietary === 'non_veg'}
                      onChange={() => setItemDietary('non_veg')}
                    />
                    <span>Non-Veg</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs ml-auto">
                    <input
                      type="checkbox"
                      checked={itemAvailable}
                      onChange={e => setItemAvailable(e.target.checked)}
                    />
                    <span>Available</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingItem}
                className="h-9 px-4 bg-ink text-paper text-xs font-bold uppercase rounded-sm hover:bg-black"
              >
                {savingItem ? 'Saving...' : editingItem ? 'Update Dish' : 'Add Dish'}
              </button>
            </form>

            {/* Menu Table */}
            <div className="border border-rule bg-white rounded-sm overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-paper-card border-b border-rule text-ink-muted font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/50">
                  {items.map(item => {
                    const catName = categories.find(c => c.id === item.category_id)?.name || 'General';
                    return (
                      <tr key={item.id} className="hover:bg-paper-subtle/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <DietaryBadge type={item.dietary} size="sm" />
                            <span className="font-medium text-ink">{item.name}</span>
                          </div>
                          {item.description && (
                            <span className="text-[11px] text-ink-muted block truncate max-w-sm">
                              {item.description}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted">{catName}</td>
                        <td className="px-4 py-2.5 font-bold tabular-nums">
                          {formatRupees(item.price_paise)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded-sm font-semibold uppercase text-[10px] ${
                              item.is_available
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.is_available ? 'Available' : 'Sold Out'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleEditClick(item)}
                            className="text-xs text-ink hover:underline font-semibold"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'tables' ? (
          /* SECTION 3: TABLES & QR CODES */
          <div className="space-y-6 max-w-4xl">
            <div className="border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-bold text-ink">
                Tables & QR Codes
              </h2>
              <p className="text-xs text-ink-muted">
                Manage physical tables, print table stand cards, and inspect customer ordering tokens.
              </p>
            </div>

            <div className="border border-rule bg-white rounded-sm overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-paper-card border-b border-rule text-ink-muted font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2">Table</th>
                    <th className="px-4 py-2">Capacity</th>
                    <th className="px-4 py-2">Active QR Token</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/50">
                  {tables.map(tbl => (
                    <tr key={tbl.id}>
                      <td className="px-4 py-2.5 font-bold text-ink">{tbl.table_number}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{tbl.seat_capacity} Guests</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-ink">{tbl.active_token}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded-sm font-semibold uppercase text-[10px] ${
                            tbl.status === 'occupied'
                              ? 'bg-amber-100 text-amber-800'
                              : tbl.status === 'billed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {tbl.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedQrTable(tbl)}
                          className="h-7 px-2.5 bg-ink text-paper text-xs font-semibold rounded-sm hover:bg-black"
                        >
                          View QR Card
                        </button>
                        <a
                          href={`/t/${tbl.active_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-ink hover:underline font-medium"
                        >
                          Open Menu &rarr;
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'staff' ? (
          /* SECTION 4: STAFF MANAGEMENT (OWNER ONLY) */
          <div className="space-y-6 max-w-4xl">
            <div className="border-b border-rule pb-2">
              <h2 className="font-serif text-xl font-bold text-ink">
                Staff Accounts
              </h2>
              <p className="text-xs text-ink-muted">
                Create staff accounts (Waiters, Kitchen, Owners) and deactivate staff when needed.
              </p>
            </div>

            {/* Create Staff Form */}
            <form onSubmit={handleCreateStaff} className="border border-rule bg-white p-4 rounded-sm space-y-3">
              <span className="block text-xs uppercase tracking-wider font-bold text-ink border-b border-rule pb-2">
                Create New Staff Account
              </span>

              {staffError && (
                <div className="p-2.5 bg-chilli/10 border border-chilli text-chilli text-xs rounded-sm">
                  {staffError}
                </div>
              )}
              {staffSuccess && (
                <div className="p-2.5 bg-green-50 border border-green-600 text-green-800 text-xs rounded-sm">
                  {staffSuccess}
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
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink"
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
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink"
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
                    className="w-full text-xs px-2.5 py-1.5 border border-rule rounded-sm text-ink"
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

            {/* Staff Accounts Table */}
            <div className="border border-rule bg-white rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-rule bg-paper-subtle">
                <h3 className="text-xs uppercase tracking-wider font-bold text-ink">
                  Active & Deactivated Staff
                </h3>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-paper-card border-b border-rule text-ink-muted font-semibold uppercase">
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
        ) : null}
      </main>

      {/* QR Code Stand Card Modal */}
      {selectedQrTable && (
        <TableQrCard
          table={selectedQrTable}
          onClose={() => setSelectedQrTable(null)}
        />
      )}
    </div>
  );
}
