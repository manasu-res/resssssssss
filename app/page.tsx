import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  const sampleTables = [
    { number: 'Table 1', token: 'tbl-manasu-01', seats: '2 seats' },
    { number: 'Table 2', token: 'tbl-manasu-02', seats: '4 seats' },
    { number: 'Table 3', token: 'tbl-manasu-03', seats: '4 seats' },
    { number: 'Table 4', token: 'tbl-manasu-04', seats: '6 seats' },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink p-4 sm:p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg border border-rule bg-paper-card p-5 sm:p-7 rounded-sm">
        {/* Header */}
        <div className="border-b border-rule pb-3.5 text-center">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-ink-muted">
            100 Feet Road, Indiranagar, Bengaluru
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-1">
            Manasu Restaurant
          </h1>
        </div>

        {/* Section 1: Tables */}
        <div className="mt-5">
          <span className="block text-xs uppercase tracking-wider font-bold text-ink-muted mb-2">
            Tables
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
                  {t.seats} &middot; Menu &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Section 2: Staff Terminals */}
        <div className="mt-5 pt-4 border-t border-rule">
          <span className="block text-xs uppercase tracking-wider font-bold text-ink-muted mb-2">
            Staff terminals
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link
              href="/waiter"
              className="p-3 border border-rule bg-white hover:border-ink rounded-sm transition-colors"
            >
              <span className="font-bold text-xs uppercase tracking-wider text-ink block">
                Waiter
              </span>
              <span className="text-[11px] text-ink-muted block mt-0.5">
                Floor POS
              </span>
            </Link>

            <Link
              href="/kitchen"
              className="p-3 border border-rule bg-pos-panel text-white hover:border-neutral-500 rounded-sm transition-colors"
            >
              <span className="font-bold text-xs uppercase tracking-wider text-amber-400 block">
                Kitchen
              </span>
              <span className="text-[11px] text-neutral-300 block mt-0.5">
                Ticket board
              </span>
            </Link>

            <Link
              href="/admin"
              className="p-3 border border-rule bg-white hover:border-ink rounded-sm transition-colors"
            >
              <span className="font-bold text-xs uppercase tracking-wider text-ink block">
                Admin
              </span>
              <span className="text-[11px] text-ink-muted block mt-0.5">
                Menu &amp; settings
              </span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3.5 border-t border-rule flex items-center justify-between text-[11px] text-ink-muted">
          <span>Single-restaurant system</span>
          <Link href="/login" className="font-semibold text-ink hover:underline">
            Staff login &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
