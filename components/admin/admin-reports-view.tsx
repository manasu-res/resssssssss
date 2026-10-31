'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { formatRupees, formatDateShort, formatTimeOnly } from '@/lib/format';

interface PaymentSplit {
  cash: { count: number; amount: number };
  upi: { count: number; amount: number };
  card: { count: number; amount: number };
}

interface DaySales {
  date: string;
  billCount: number;
  subtotal: number;
  tax: number;
  totalSales: number;
  cash: number;
  upi: number;
  card: number;
}

interface TopSellingItem {
  name: string;
  type: 'Item' | 'Combo';
  quantity: number;
  totalRevenue: number;
}

interface BillRow {
  id: string;
  bill_no: string;
  table_number: string;
  paid_at: string;
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  is_cancelled: boolean;
  items_count: number;
  items_summary: string;
}

interface CancelledOrderRow {
  id: string;
  order_number: string;
  table_number: string;
  created_at: string;
  source: string;
  reason: string;
  items: Array<{ name: string; quantity: number }>;
}

export function AdminReportsView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range defaults to last 7 days
  const todayStr = new Date().toISOString().split('T')[0];
  const last7DaysStr = new Date(Date.now() - 6 * 24 * 3600000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(last7DaysStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Search filter for bills list
  const [billSearch, setBillSearch] = useState('');

  // Report data state
  const [todaySummary, setTodaySummary] = useState<{
    total: number;
    billCount: number;
    average: number;
    split: PaymentSplit;
  }>({
    total: 0,
    billCount: 0,
    average: 0,
    split: {
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
    },
  });

  const [rangeSummary, setRangeSummary] = useState<{
    total: number;
    billCount: number;
    average: number;
    split: PaymentSplit;
  }>({
    total: 0,
    billCount: 0,
    average: 0,
    split: {
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
    },
  });

  const [dayByDay, setDayByDay] = useState<DaySales[]>([]);
  const [topSelling, setTopSelling] = useState<TopSellingItem[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<CancelledOrderRow[]>([]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/reports?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load reports');
      }
      const data = await res.json();
      setTodaySummary(data.today);
      setRangeSummary(data.range);
      setDayByDay(data.dayByDay || []);
      setTopSelling(data.topSelling || []);
      setBills(data.bills || []);
      setCancelledOrders(data.cancelledOrders || []);
    } catch (err: any) {
      setError(err.message || 'Error generating reports');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Presets
  const setPreset = (type: 'today' | '7days' | '30days' | 'month') => {
    const end = todayStr;
    let start = todayStr;
    if (type === '7days') {
      start = new Date(Date.now() - 6 * 24 * 3600000).toISOString().split('T')[0];
    } else if (type === '30days') {
      start = new Date(Date.now() - 29 * 24 * 3600000).toISOString().split('T')[0];
    } else if (type === 'month') {
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      start = firstOfMonth.toISOString().split('T')[0];
    }
    setStartDate(start);
    setEndDate(end);
  };

  // CSV Export for bills list
  const handleDownloadCSV = () => {
    if (bills.length === 0) return;

    const headers = ['Bill Number', 'Table', 'Date', 'Time', 'Payment Method', 'Subtotal (INR)', 'Tax (INR)', 'Total (INR)', 'Status', 'Items Summary'];
    const rows = bills.map(b => {
      const dateStr = formatDateShort(b.paid_at);
      const timeStr = formatTimeOnly(b.paid_at);
      const subtotalRupees = (b.subtotal / 100).toFixed(2);
      const taxRupees = (b.tax_amount / 100).toFixed(2);
      const totalRupees = (b.total / 100).toFixed(2);
      const statusStr = b.is_cancelled ? 'CANCELLED' : 'PAID';
      const escapedSummary = `"${(b.items_summary || '').replace(/"/g, '""')}"`;

      return [b.bill_no, b.table_number, dateStr, timeStr, b.payment_method.toUpperCase(), subtotalRupees, taxRupees, totalRupees, statusStr, escapedSummary].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `manasu-bills-${startDate}-to-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter bills by search query
  const filteredBills = bills.filter(b => {
    if (!billSearch.trim()) return true;
    const query = billSearch.toLowerCase().trim();
    return (
      b.bill_no.toLowerCase().includes(query) ||
      b.table_number.toLowerCase().includes(query) ||
      b.payment_method.toLowerCase().includes(query)
    );
  });

  // Calculate max sales for the simple bar chart
  const maxDaySales = Math.max(...dayByDay.map(d => d.totalSales), 1);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Title & Section Header */}
      <div className="border-b border-rule pb-3">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-ink">
          Sales & Financial Reports
        </h2>
        <p className="text-xs text-ink-muted mt-0.5">
          Audited sales metrics, daily breakdown, top selling items, and cancellation tracking.
        </p>
      </div>

      {/* 1. TODAY'S SALES (Always visible snapshot) */}
      <section className="space-y-2">
        <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-ink">
          Today&apos;s Sales Overview
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-rule bg-white divide-x divide-y md:divide-y-0 divide-rule">
          <div className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Today&apos;s Sales
            </span>
            <span className="text-xl font-bold tabular-nums text-ink block mt-0.5">
              {formatRupees(todaySummary.total)}
            </span>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Number of Bills
            </span>
            <span className="text-xl font-bold tabular-nums text-ink block mt-0.5">
              {todaySummary.billCount}
            </span>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Average Bill
            </span>
            <span className="text-xl font-bold tabular-nums text-ink block mt-0.5">
              {formatRupees(todaySummary.average)}
            </span>
          </div>

          <div className="p-3.5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Payment Split
            </span>
            <div className="text-xs space-y-0.5 tabular-nums text-ink font-medium">
              <div className="flex justify-between">
                <span>UPI:</span>
                <span>{formatRupees(todaySummary.split.upi.amount)} ({todaySummary.split.upi.count})</span>
              </div>
              <div className="flex justify-between">
                <span>Cash:</span>
                <span>{formatRupees(todaySummary.split.cash.amount)} ({todaySummary.split.cash.count})</span>
              </div>
              <div className="flex justify-between">
                <span>Card:</span>
                <span>{formatRupees(todaySummary.split.card.amount)} ({todaySummary.split.card.count})</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DATE RANGE PICKER & RANGE SUMMARY */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-2.5">
          <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-ink">
            Date Range Analysis
          </h3>

          {/* Date Picker Controls & Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1 border border-rule bg-white text-ink text-xs rounded-sm focus:outline-none focus:border-chilli"
              />
              <span className="text-ink-muted">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1 border border-rule bg-white text-ink text-xs rounded-sm focus:outline-none focus:border-chilli"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreset('today')}
                className={`px-2 py-1 text-xs border rounded-sm ${
                  startDate === todayStr && endDate === todayStr ? 'bg-ink text-paper border-ink font-bold' : 'bg-white border-rule text-ink hover:bg-paper-subtle'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setPreset('7days')}
                className={`px-2 py-1 text-xs border rounded-sm ${
                  startDate === last7DaysStr && endDate === todayStr ? 'bg-ink text-paper border-ink font-bold' : 'bg-white border-rule text-ink hover:bg-paper-subtle'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setPreset('month')}
                className="px-2 py-1 text-xs border border-rule bg-white text-ink hover:bg-paper-subtle rounded-sm"
              >
                This Month
              </button>
            </div>
          </div>
        </div>

        {/* Selected Range Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-rule bg-white divide-x divide-y md:divide-y-0 divide-rule">
          <div className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Range Total Sales
            </span>
            <span className="text-xl font-bold tabular-nums text-ink block mt-0.5">
              {formatRupees(rangeSummary.total)}
            </span>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Range Bills Count
            </span>
            <span className="text-xl font-bold tabular-nums text-ink block mt-0.5">
              {rangeSummary.billCount}
            </span>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Average Bill (Range)
            </span>
            <span className="text-xl font-bold tabular-nums text-ink block mt-0.5">
              {formatRupees(rangeSummary.average)}
            </span>
          </div>

          <div className="p-3.5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
              Payment Method Breakdown
            </span>
            <div className="text-xs space-y-0.5 tabular-nums text-ink font-medium">
              <div className="flex justify-between">
                <span>UPI:</span>
                <span>{formatRupees(rangeSummary.split.upi.amount)} ({rangeSummary.split.upi.count})</span>
              </div>
              <div className="flex justify-between">
                <span>Cash:</span>
                <span>{formatRupees(rangeSummary.split.cash.amount)} ({rangeSummary.split.cash.count})</span>
              </div>
              <div className="flex justify-between">
                <span>Card:</span>
                <span>{formatRupees(rangeSummary.split.card.amount)} ({rangeSummary.split.card.count})</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. A SINGLE SIMPLE BAR CHART (No gradients, no dashboard cards) */}
        {dayByDay.length > 0 && (
          <div className="border border-rule bg-white p-4 rounded-sm space-y-2">
            <div className="flex justify-between items-baseline border-b border-rule/50 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                Daily Sales Trend ({dayByDay.length} Days)
              </span>
              <span className="text-[11px] text-ink-muted">
                Peak Day: {formatRupees(maxDaySales)}
              </span>
            </div>

            <div className="pt-6 pb-2">
              <div className="h-44 flex items-end justify-between gap-2 border-b border-rule">
                {dayByDay.map(day => {
                  const heightPercent = Math.max(8, Math.round((day.totalSales / maxDaySales) * 100));
                  const dateLabel = new Date(day.date).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center justify-end h-full group"
                    >
                      {/* Hover Tooltip Value */}
                      <span className="text-[10px] font-bold font-mono text-ink tabular-nums opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                        {formatRupees(day.totalSales)}
                      </span>

                      {/* Bar (Solid Ink, Hover Chilli) */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[42px] bg-ink hover:bg-chilli transition-colors rounded-none"
                        title={`${dateLabel}: ${formatRupees(day.totalSales)} (${day.billCount} bills)`}
                      />

                      {/* Day Label Below */}
                      <span className="text-[10px] font-medium text-ink-muted mt-2 truncate w-full text-center">
                        {dateLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. DAY-BY-DAY TABLE */}
        <div className="space-y-1.5 pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink block">
            Day-by-Day Financial Breakdown
          </span>

          <div className="border border-rule bg-white overflow-x-auto rounded-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-subtle border-b border-rule text-ink uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Date</th>
                  <th className="py-2.5 px-3 font-bold text-center">Bills</th>
                  <th className="py-2.5 px-3 font-bold text-right">Subtotal</th>
                  <th className="py-2.5 px-3 font-bold text-right">Tax (5%)</th>
                  <th className="py-2.5 px-3 font-bold text-right">Total Sales</th>
                  <th className="py-2.5 px-3 font-bold text-right">UPI</th>
                  <th className="py-2.5 px-3 font-bold text-right">Cash</th>
                  <th className="py-2.5 px-3 font-bold text-right">Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule font-medium text-ink tabular-nums">
                {dayByDay.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-ink-muted">
                      No billed sales found for this date range.
                    </td>
                  </tr>
                ) : (
                  dayByDay.map(d => (
                    <tr key={d.date} className="hover:bg-paper-subtle/50">
                      <td className="py-2 px-3 font-bold text-ink">
                        {new Date(d.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-2 px-3 text-center">{d.billCount}</td>
                      <td className="py-2 px-3 text-right">{formatRupees(d.subtotal)}</td>
                      <td className="py-2 px-3 text-right">{formatRupees(d.tax)}</td>
                      <td className="py-2 px-3 text-right font-bold">{formatRupees(d.totalSales)}</td>
                      <td className="py-2 px-3 text-right text-ink-muted">{formatRupees(d.upi)}</td>
                      <td className="py-2 px-3 text-right text-ink-muted">{formatRupees(d.cash)}</td>
                      <td className="py-2 px-3 text-right text-ink-muted">{formatRupees(d.card)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. TOP SELLING ITEMS AND COMBOS */}
      <section className="space-y-2 pt-2">
        <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-ink">
          Top Selling Items & Combos (For Selected Range)
        </h3>

        <div className="border border-rule bg-white overflow-x-auto rounded-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-subtle border-b border-rule text-ink uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-bold w-12 text-center">#</th>
                <th className="py-2.5 px-3 font-bold">Item / Combo Name</th>
                <th className="py-2.5 px-3 font-bold text-center w-24">Type</th>
                <th className="py-2.5 px-3 font-bold text-center w-24">Quantity Sold</th>
                <th className="py-2.5 px-3 font-bold text-right w-36">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-ink font-medium">
              {topSelling.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-muted">
                    No sales recorded in this range.
                  </td>
                </tr>
              ) : (
                topSelling.map((it, idx) => (
                  <tr key={idx} className="hover:bg-paper-subtle/50">
                    <td className="py-2 px-3 text-center text-ink-muted font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold">{it.name}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${
                          it.type === 'Combo'
                            ? 'bg-chilli text-white'
                            : 'border border-rule bg-paper-subtle text-ink'
                        }`}
                      >
                        {it.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums">
                      {formatRupees(it.totalRevenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. BILLS LIST WITH SEARCH & "DOWNLOAD CSV" */}
      <section className="space-y-2 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-2">
          <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-ink">
            Bills Ledger ({filteredBills.length} Bills)
          </h3>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={billSearch}
              onChange={e => setBillSearch(e.target.value)}
              placeholder="Search bill # or table..."
              className="text-xs px-2.5 py-1.5 border border-rule bg-white rounded-sm w-48 focus:outline-none focus:border-chilli"
            />

            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={bills.length === 0}
              className="h-8 px-3 bg-ink hover:bg-black text-paper text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              Download CSV &darr;
            </button>
          </div>
        </div>

        <div className="border border-rule bg-white overflow-x-auto rounded-sm max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-subtle border-b border-rule text-ink uppercase tracking-wider text-[11px] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 font-bold w-24">Bill #</th>
                <th className="py-2.5 px-3 font-bold w-24">Table</th>
                <th className="py-2.5 px-3 font-bold">Date & Time</th>
                <th className="py-2.5 px-3 font-bold text-center w-24">Payment</th>
                <th className="py-2.5 px-3 font-bold text-right w-24">Total (INR)</th>
                <th className="py-2.5 px-3 font-bold text-center w-24">Status</th>
                <th className="py-2.5 px-3 font-bold">Items Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-ink font-medium">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-muted">
                    No matching bills found.
                  </td>
                </tr>
              ) : (
                filteredBills.map(b => (
                  <tr key={b.id} className="hover:bg-paper-subtle/50">
                    <td className="py-2 px-3 font-mono font-bold">{b.bill_no}</td>
                    <td className="py-2 px-3 font-semibold">{b.table_number}</td>
                    <td className="py-2 px-3 text-ink-muted">
                      {formatDateShort(b.paid_at)} {formatTimeOnly(b.paid_at)}
                    </td>
                    <td className="py-2 px-3 text-center uppercase font-bold text-[10px]">
                      {b.payment_method}
                    </td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums">
                      {formatRupees(b.total)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-sm ${
                          b.is_cancelled
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {b.is_cancelled ? 'Cancelled' : 'Paid'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-ink-muted truncate max-w-xs">
                      {b.items_summary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. CANCELLED OR REJECTED ORDERS LIST (Problem Spotting) */}
      <section className="space-y-2 pt-2">
        <div className="border-b border-rule pb-2">
          <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-ink">
            Cancelled &amp; Rejected Orders (Problem Tracking)
          </h3>
          <p className="text-[11px] text-ink-muted">
            Floor staff rejections, out-of-stock items, or customer cancellations within the selected date range.
          </p>
        </div>

        <div className="border border-rule bg-white overflow-x-auto rounded-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-subtle border-b border-rule text-ink uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-bold w-24">Order #</th>
                <th className="py-2.5 px-3 font-bold w-24">Table</th>
                <th className="py-2.5 px-3 font-bold w-36">Time</th>
                <th className="py-2.5 px-3 font-bold w-24">Source</th>
                <th className="py-2.5 px-3 font-bold">Ordered Items</th>
                <th className="py-2.5 px-3 font-bold">Cancellation Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-ink font-medium">
              {cancelledOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-muted">
                    No cancelled or rejected orders in this period.
                  </td>
                </tr>
              ) : (
                cancelledOrders.map(co => (
                  <tr key={co.id} className="hover:bg-red-50/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-chilli">
                      {co.order_number}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{co.table_number}</td>
                    <td className="py-2.5 px-3 text-ink-muted">
                      {formatDateShort(co.created_at)} {formatTimeOnly(co.created_at)}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[10px] font-bold">
                      {co.source}
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      {co.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-red-900 text-[11px]">
                      {co.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
