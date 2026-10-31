import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  const sampleTables = [
    { number: 'Table 1', token: 'tbl-manasu-01', seats: '2 Seats' },
    { number: 'Table 2', token: 'tbl-manasu-02', seats: '4 Seats' },
    { number: 'Table 3', token: 'tbl-manasu-03', seats: '4 Seats' },
    { number: 'Table 4', token: 'tbl-manasu-04', seats: '6 Seats' },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl border border-rule bg-paper-card p-6 md:p-8 rounded-sm">
        {/* Header */}
        <div className="border-b border-rule pb-4 text-center">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-ink-muted">
            100 Feet Road, Indiranagar, Bengaluru
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink mt-1">
            Manasu Restaurant
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Ordering &amp; POS Billing Terminal
          </p>
        </div>

        {/* Section 1: Customer Tables */}
        <div className="mt-6">
          <span className="block text-xs uppercase tracking-wider font-bold text-ink-muted mb-2">
            Customer Table QR Portals (/t/[token])
          </span>
          <div className="grid grid-cols-2 gap-2">
            {sampleTables.map(t => (
              <Link
                key={t.token}
                href={`/t/${t.token}`}
                className="p-3 border border-rule bg-white hover:border-ink rounded-sm transition-colors text-left"
              >
                <span className="font-serif font-bold text-sm text-ink block">
                  {t.number}
                </span>
                <span className="text-[11px] text-ink-muted block mt-0.5">
                  {t.seats} &bull; Open Menu &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Section 2: Staff Operation Consoles */}
        <div className="mt-6 pt-5 border-t border-rule/70">
          <span className="block text-xs uppercase tracking-wider font-bold text-ink-muted mb-2">
            Staff Terminals
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              href="/waiter"
              className="p-3 border border-rule bg-white hover:border-ink rounded-sm transition-colors"
            >
              <span className="font-bold text-xs uppercase tracking-wider text-ink block">
                Waiter POS
              </span>
              <span className="text-[11px] text-ink-muted block mt-1">
                Approve orders, tables &amp; bills
              </span>
            </Link>

            <Link
              href="/kitchen"
              className="p-3 border border-rule bg-pos-panel text-white hover:border-white rounded-sm transition-colors"
            >
              <span className="font-bold text-xs uppercase tracking-wider text-amber-400 block">
                Kitchen KDS
              </span>
              <span className="text-[11px] text-neutral-300 block mt-1">
                Live order queue (2m readable)
              </span>
            </Link>

            <Link
              href="/admin"
              className="p-3 border border-rule bg-white hover:border-ink rounded-sm transition-colors"
            >
              <span className="font-bold text-xs uppercase tracking-wider text-ink block">
                Owner Admin
              </span>
              <span className="text-[11px] text-ink-muted block mt-1">
                Menu, QRs, sales reports
              </span>
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-rule text-center flex items-center justify-between text-[11px] text-ink-muted">
          <span>Single-Restaurant System</span>
          <Link href="/login" className="font-semibold text-ink hover:underline">
            Staff Login &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
