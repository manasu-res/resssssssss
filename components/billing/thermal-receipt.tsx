'use client';

import React, { useState, useEffect } from 'react';
import { formatRupees, formatDateShort, formatTimeOnly } from '@/lib/format';

export interface ThermalReceiptItem {
  item_name?: string;
  name?: string;
  quantity: number;
  price_paise?: number;
  price?: number;
}

export interface ThermalReceiptBill {
  id: string;
  bill_number?: string | number;
  bill_no?: string;
  created_at: string;
  paid_at?: string;
  subtotal_paise: number;
  tax_paise: number;
  discount_paise?: number;
  final_paise: number;
  payment_method: string;
  table?: { table_number?: string; label?: string };
  items?: ThermalReceiptItem[];
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  settings?: {
    restaurant_name?: string;
    address?: string;
    phone?: string;
    gstin?: string | null;
    tax_percent?: number;
    bill_footer?: string;
    paper_width?: '80mm' | '58mm';
  };
}

interface ThermalReceiptProps {
  bill: ThermalReceiptBill;
  autoPrint?: boolean;
  onClose: () => void;
}

export function ThermalReceipt({ bill, autoPrint = true, onClose }: ThermalReceiptProps) {
  // Allow toggling paper width between 80mm and 58mm
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(
    bill.settings?.paper_width === '58mm' ? '58mm' : '80mm'
  );

  // Auto-open browser print dialog on mount if autoPrint is true
  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  const restaurantName = bill.settings?.restaurant_name || 'MANASU RESTAURANT';
  const address = bill.settings?.address || '100 Feet Road, Indiranagar, Bengaluru';
  const phone = bill.settings?.phone || '+91 80 2520 1980';
  const gstin = bill.settings?.gstin || '29AABCM8291Q1ZP';
  const taxPercent = bill.settings?.tax_percent ?? 0;
  const billFooter = bill.settings?.bill_footer || 'Thank you for dining at Manasu! Visit again.';

  const items = bill.items || [];
  const billNo = bill.bill_no || bill.bill_number || bill.id.slice(-4);
  const billDate = bill.paid_at || bill.created_at;
  const tableLabel = bill.table?.table_number || (bill.table?.label ? `Table ${bill.table.label}` : 'Table');

  const cgstPercent = (taxPercent / 2).toFixed(1).replace('.0', '');
  const sgstPercent = (taxPercent / 2).toFixed(1).replace('.0', '');
  const cgstPaise = Math.round(bill.tax_paise / 2);
  const sgstPaise = bill.tax_paise - cgstPaise;

  const is58mm = paperWidth === '58mm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 overflow-y-auto">
      {/* Dynamic Print CSS for thermal paper roll */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${paperWidth} auto;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            width: ${paperWidth} !important;
          }
          /* Hide all application elements during printing */
          header, nav, main, footer, aside, .print\\:hidden {
            display: none !important;
          }
          #thermal-print-container {
            display: block !important;
            width: ${paperWidth} !important;
            max-width: ${paperWidth} !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="bg-white text-black w-full max-w-sm rounded-none border border-neutral-400 p-4 shadow-none my-auto">
        {/* On-screen controls */}
        <div className="flex items-center justify-between border-b pb-2.5 mb-3 print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              Width:
            </span>
            <div className="inline-flex border border-neutral-300 rounded-sm overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-1 font-bold ${
                  paperWidth === '80mm' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-1 font-bold ${
                  paperWidth === '58mm' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                58mm
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[38px] px-3.5 bg-neutral-900 text-white text-xs font-bold rounded-sm uppercase tracking-wider hover:bg-black cursor-pointer"
            >
              Print Bill
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-3 border border-neutral-300 text-xs font-bold rounded-sm uppercase tracking-wider text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Card */}
        <div
          id="thermal-print-container"
          className={`font-mono text-black mx-auto leading-tight ${
            is58mm ? 'text-[10px] max-w-[54mm]' : 'text-xs max-w-[76mm]'
          }`}
        >
          {/* Cancelled Watermark Banner */}
          {bill.is_cancelled && (
            <div className="text-center font-bold text-sm border-2 border-black p-1 mb-2 uppercase">
              *** CANCELLED BILL ***
              {bill.cancellation_reason && (
                <div className="text-[10px] font-normal mt-0.5">
                  Reason: {bill.cancellation_reason}
                </div>
              )}
            </div>
          )}

          {/* Restaurant Header */}
          <div className="text-center space-y-0.5">
            <div className="text-base font-black tracking-wide uppercase">
              {restaurantName}
            </div>
            <div className="text-[10px] leading-tight text-neutral-800">
              {address}
            </div>
            {phone && (
              <div className="text-[10px]">Ph: {phone}</div>
            )}
            {gstin && (
              <div className="text-[10px] font-bold">GSTIN: {gstin}</div>
            )}
          </div>

          <div className="border-t border-dashed border-black my-2" />

          {/* Bill Meta */}
          <div className="flex justify-between items-baseline font-bold text-xs">
            <span>BILL #{billNo}</span>
            <span>{tableLabel.toUpperCase()}</span>
          </div>

          <div className="flex justify-between text-[10px] text-neutral-800 mt-0.5">
            <span>Date: {formatDateShort(billDate)}</span>
            <span>Time: {formatTimeOnly(billDate)}</span>
          </div>

          <div className="border-t border-dashed border-black my-2" />

          {/* Column Headers */}
          <div className="flex justify-between text-[10px] font-bold uppercase pb-0.5">
            <span className="flex-1">ITEM</span>
            <span className="w-10 text-center">QTY</span>
            <span className="w-16 text-right">AMT (INR)</span>
          </div>

          <div className="border-t border-dashed border-black my-1" />

          {/* Grouped Line Items */}
          <div className="space-y-1.5 my-1.5">
            {items.map((it, idx) => {
              const name = it.item_name || it.name || 'Item';
              const pricePaise = it.price_paise ?? it.price ?? 0;
              const lineTotalPaise = pricePaise * it.quantity;

              return (
                <div key={idx} className="flex justify-between items-start text-xs">
                  <span className="flex-1 pr-1 truncate font-medium">
                    {name}
                  </span>
                  <span className="w-10 text-center tabular-nums">
                    {it.quantity}
                  </span>
                  <span className="w-16 text-right tabular-nums font-semibold">
                    {(lineTotalPaise / 100).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-dashed border-black my-2" />

          {/* Subtotal, Tax Breakdown, Discounts, Grand Total */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="tabular-nums">{(bill.subtotal_paise / 100).toFixed(2)}</span>
            </div>

            {taxPercent > 0 && (
              <>
                <div className="flex justify-between text-[11px] text-neutral-800">
                  <span>CGST ({cgstPercent}%):</span>
                  <span className="tabular-nums">{(cgstPaise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-800">
                  <span>SGST ({sgstPercent}%):</span>
                  <span className="tabular-nums">{(sgstPaise / 100).toFixed(2)}</span>
                </div>
              </>
            )}

            {bill.discount_paise && bill.discount_paise > 0 ? (
              <div className="flex justify-between text-[11px] font-medium">
                <span>Discount:</span>
                <span className="tabular-nums">-{(bill.discount_paise / 100).toFixed(2)}</span>
              </div>
            ) : null}

            <div className="border-t border-dashed border-black pt-1.5 mt-1 flex justify-between font-black text-sm">
              <span>GRAND TOTAL:</span>
              <span className="tabular-nums">
                {formatRupees(bill.final_paise)}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-black my-2" />

          {/* Payment Method & Cashier */}
          <div className="text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span>Payment Method:</span>
              <span className="font-bold uppercase tracking-wider">{bill.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Status:</span>
              <span className="font-bold uppercase">PAID</span>
            </div>
          </div>

          <div className="border-t border-dashed border-black my-2" />

          {/* Footer Note from Settings */}
          <div className="text-center text-[10px] space-y-0.5 pt-0.5">
            <div className="font-bold uppercase">{billFooter}</div>
            <div className="text-[9px] text-neutral-600">Please retain this bill for your records</div>
          </div>
        </div>
      </div>
    </div>
  );
}
