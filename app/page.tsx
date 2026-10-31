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

        {/* Footer: Staff Access */}
        <div className="mt-5 pt-3.5 border-t border-rule flex items-center justify-between text-xs text-ink-muted">
          <span>Bengaluru &middot; Indiranagar</span>
          <Link
            href="/login"
            className="font-bold text-xs uppercase tracking-wider text-ink border border-ink/40 bg-white hover:bg-paper-subtle px-3 py-1.5 rounded-sm"
          >
            Staff login &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
