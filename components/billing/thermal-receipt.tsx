'use client';

import React from 'react';
import { Bill } from '@/lib/types';
import { formatRupees, formatDateShort, formatTimeOnly } from '@/lib/format';

interface ThermalReceiptProps {
  bill: Bill;
  onClose: () => void;
}

export function ThermalReceipt({ bill, onClose }: ThermalReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const items = bill.items || [];
  const cgstPaise = Math.round(bill.tax_paise / 2);
  const sgstPaise = bill.tax_paise - cgstPaise;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 overflow-y-auto">
      <div className="bg-white text-black w-full max-w-sm rounded-none border border-neutral-300 p-4 shadow-none my-auto">
        {/* Screen controls */}
        <div className="flex items-center justify-between border-b pb-2 mb-3 print:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Thermal Receipt Preview
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-3 bg-neutral-900 text-white text-xs font-bold rounded-sm uppercase tracking-wider hover:bg-neutral-800"
            >
              Print Bill
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 border border-neutral-300 text-xs font-bold rounded-sm uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div id="thermal-receipt" className="font-mono text-xs leading-tight">
          <div className="text-center space-y-0.5">
            <div className="text-sm font-bold tracking-wider">MANASU RESTAURANT</div>
            <div className="text-[10px]">100 Feet Road, Indiranagar, Bengaluru</div>
            <div className="text-[10px]">GSTIN: 29AABCM8291Q1ZP</div>
            <div className="text-[10px]">Phone: +91 80 2520 1980</div>
          </div>

          <div className="border-t border-dashed border-black my-2" />

          <div className="flex justify-between text-[11px]">
            <span>Bill #{bill.bill_number}</span>
            <span>{bill.table?.table_number || 'Table'}</span>
          </div>
          <div className="flex justify-between text-[10px] text-neutral-600">
            <span>Date: {formatDateShort(bill.created_at)}</span>
            <span>Time: {formatTimeOnly(bill.created_at)}</span>
          </div>

          <div className="border-t border-dashed border-black my-2" />

          {/* Item Headers */}
          <div className="flex justify-between text-[10px] font-bold">
            <span className="w-1/2">ITEM</span>
            <span className="w-12 text-center">QTY</span>
            <span className="w-16 text-right">AMT</span>
          </div>

          <div className="border-t border-dashed border-black my-1" />

          {/* Item Lines */}
          <div className="space-y-1 my-1">
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="w-1/2 truncate">{it.item_name}</span>
                <span className="w-12 text-center tabular-nums">{it.quantity}</span>
                <span className="w-16 text-right tabular-nums">
                  {formatRupees(it.price_paise * it.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-black my-2" />

          {/* Totals */}
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="tabular-nums">{formatRupees(bill.subtotal_paise)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>CGST (2.5%):</span>
              <span className="tabular-nums">{formatRupees(cgstPaise)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>SGST (2.5%):</span>
              <span className="tabular-nums">{formatRupees(sgstPaise)}</span>
            </div>
            {bill.discount_paise > 0 && (
              <div className="flex justify-between text-[10px]">
                <span>Discount:</span>
                <span className="tabular-nums">-{formatRupees(bill.discount_paise)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-black pt-1 flex justify-between font-bold text-xs">
              <span>TOTAL (INR):</span>
              <span className="tabular-nums">{formatRupees(bill.final_paise)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-black my-2" />

          <div className="text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold uppercase">{bill.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>Floor Staff</span>
            </div>
          </div>

          <div className="border-t border-dashed border-black my-2" />

          <div className="text-center text-[10px] space-y-0.5">
            <div className="font-bold">THANK YOU! VISIT AGAIN</div>
            <div className="text-[9px]">Manasu Restaurant Bengaluru</div>
          </div>
        </div>
      </div>
    </div>
  );
}
