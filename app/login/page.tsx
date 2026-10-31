'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent, directEmail?: string) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const loginEmail = directEmail || email;
    const loginPassword = password || 'Manasu2026!';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      router.push(data.redirectTo || '/waiter');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (type: 'waiter' | 'kitchen' | 'owner') => {
    const creds = {
      waiter: 'waiter@manasu.com',
      kitchen: 'kitchen@manasu.com',
      owner: 'owner@manasu.com',
    };
    setEmail(creds[type]);
    setPassword('Manasu2026!');
    handleLogin(undefined, creds[type]);
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-rule bg-paper-card p-6 rounded-sm">
        <div className="border-b border-rule pb-3 mb-4">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted">
            Internal Staff POS
          </span>
          <h1 className="font-serif text-2xl font-bold text-ink">
            Manasu Restaurant
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Bengaluru &bull; Staff Authentication
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-chilli-light border border-chilli text-chilli text-xs rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
              Staff Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. waiter@manasu.com"
              className="w-full h-11 px-3 text-sm bg-white border border-rule rounded-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1">
              PIN / Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-3 text-sm bg-white border border-rule rounded-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-ink hover:bg-black text-paper text-sm font-semibold rounded-sm transition-colors mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* 1-Tap Quick Staff Role Switcher for Instant Testing */}
        <div className="mt-6 pt-4 border-t border-rule/70">
          <span className="block text-[11px] uppercase tracking-wider text-ink-muted font-bold mb-2">
            Quick Staff Access (Dev / Testing)
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => quickLogin('waiter')}
              className="h-11 px-2 border border-ink/40 bg-white hover:bg-paper-subtle text-xs font-semibold text-ink rounded-sm flex flex-col items-center justify-center leading-tight"
            >
              <span>Waiter</span>
              <span className="text-[9px] text-ink-muted">Floor</span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin('kitchen')}
              className="h-11 px-2 border border-ink/40 bg-white hover:bg-paper-subtle text-xs font-semibold text-ink rounded-sm flex flex-col items-center justify-center leading-tight"
            >
              <span>Kitchen</span>
              <span className="text-[9px] text-ink-muted">KDS</span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin('owner')}
              className="h-11 px-2 border border-ink/40 bg-white hover:bg-paper-subtle text-xs font-semibold text-ink rounded-sm flex flex-col items-center justify-center leading-tight"
            >
              <span>Owner</span>
              <span className="text-[9px] text-ink-muted">Admin</span>
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a
            href="/t/tbl-manasu-01"
            className="text-[11px] text-ink-muted hover:text-ink underline"
          >
            Switch to Customer Table Menu &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
