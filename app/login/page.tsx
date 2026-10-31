'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const isRealSupabase =
        url.startsWith('https://') &&
        !url.includes('demo') &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('demo');

      if (!isRealSupabase) {
        // Fallback for local demo environment
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to sign in.');
        }
        router.push(data.redirectTo || '/waiter');
        router.refresh();
        return;
      }

      const supabase = createBrowserSupabaseClient();

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Invalid email or password.');
      }

      // Query staff profile for role and active status
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('role, is_active')
        .eq('id', authData.user.id)
        .single();

      const profile = profileData as { role: string; is_active: boolean } | null;

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Staff profile not found. Contact the owner.');
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('This account has been deactivated.');
      }

      // Redirect by role
      if (profile.role === 'owner') {
        router.push('/admin');
      } else if (profile.role === 'kitchen') {
        router.push('/kitchen');
      } else {
        router.push('/waiter');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-rule bg-paper-card p-6 rounded-sm">
        {/* Header: Plain and quiet */}
        <div className="text-center mb-6">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-ink">
            Manasu Restaurant
          </h1>
          <p className="text-xs uppercase tracking-widest text-ink-muted mt-0.5">
            Bengaluru
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-chilli/10 border border-chilli text-chilli text-xs rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="staff-email"
              className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1"
            >
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 px-3 text-sm bg-white border border-rule rounded-sm text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label
              htmlFor="staff-password"
              className="block text-xs uppercase tracking-wider font-semibold text-ink-muted mb-1"
            >
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 px-3 text-sm bg-white border border-rule rounded-sm text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] h-12 bg-ink text-paper hover:bg-black disabled:opacity-50 text-xs sm:text-sm font-semibold uppercase tracking-wider rounded-sm transition-colors mt-2 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
