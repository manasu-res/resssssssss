'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RestaurantTable } from '@/lib/types';

interface TableQrCardProps {
  table: RestaurantTable;
  onClose: () => void;
}

export function TableQrCard({ table, onClose }: TableQrCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const appBaseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const tableUrl = `${appBaseUrl}/t/${table.active_token}`;

  useEffect(() => {
    QRCode.toDataURL(tableUrl, {
      width: 260,
      margin: 1,
      color: {
        dark: '#1F1B16',
        light: '#FFFFFF',
      },
    }).then(setQrDataUrl);
  }, [tableUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-paper border border-rule w-full max-w-sm p-6 text-center rounded-sm">
        <div className="border border-ink/40 p-6 bg-paper-card rounded-sm">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted block">
            MANASU RESTAURANT &middot; BENGALURU
          </span>
          <h2 className="font-serif text-3xl font-extrabold text-ink my-1">
            {table.table_number}
          </h2>
          <p className="text-xs text-ink-muted mb-4">
            {table.seat_capacity} Seats &bull; Dine-In
          </p>

          {qrDataUrl ? (
            <div className="flex justify-center my-3 bg-white p-3 border border-rule rounded-sm inline-block mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR for ${table.table_number}`} className="w-48 h-48" />
            </div>
          ) : (
            <div className="w-48 h-48 mx-auto flex items-center justify-center text-xs text-ink-muted">
              Generating QR...
            </div>
          )}

          <p className="text-xs font-semibold text-ink uppercase tracking-wider mt-2">
            Scan to view menu & place order
          </p>
          <p className="text-[10px] text-ink-muted mt-0.5 break-all font-mono">
            {tableUrl}
          </p>
        </div>

        <div className="mt-4 flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-4 bg-ink text-paper text-xs font-bold uppercase rounded-sm hover:bg-black"
          >
            Print Table Card
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(tableUrl);
              alert('Copied table URL to clipboard!');
            }}
            className="h-10 px-3 border border-rule text-xs font-semibold rounded-sm hover:bg-paper-subtle"
          >
            Copy Link
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 border border-rule text-xs font-semibold rounded-sm hover:bg-paper-subtle"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
