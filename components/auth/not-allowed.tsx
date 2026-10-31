import React from 'react';
import Link from 'next/link';

interface NotAllowedProps {
  userRole?: string;
  requiredRoles?: string[];
}

export function NotAllowed({ userRole, requiredRoles }: NotAllowedProps) {
  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-sm border border-rule bg-paper-card p-6 rounded-sm text-center">
        <h1 className="font-serif text-2xl font-bold text-ink">
          Not allowed
        </h1>
        <p className="text-xs text-ink-muted mt-2">
          Your account does not have permission to view this page.
        </p>

        {userRole && (
          <div className="mt-3 text-[11px] text-ink-muted font-mono">
            Signed in role: <span className="text-ink font-bold uppercase">{userRole}</span>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-rule flex flex-col gap-2 text-xs">
          {userRole === 'waiter' && (
            <Link
              href="/waiter"
              className="h-10 px-4 bg-ink text-paper rounded-sm font-semibold flex items-center justify-center hover:bg-black"
            >
              Go to Waiter POS &rarr;
            </Link>
          )}
          {userRole === 'kitchen' && (
            <Link
              href="/kitchen"
              className="h-10 px-4 bg-ink text-paper rounded-sm font-semibold flex items-center justify-center hover:bg-black"
            >
              Go to Kitchen Screen &rarr;
            </Link>
          )}
          {userRole === 'owner' && (
            <Link
              href="/admin"
              className="h-10 px-4 bg-ink text-paper rounded-sm font-semibold flex items-center justify-center hover:bg-black"
            >
              Go to Admin &rarr;
            </Link>
          )}

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full h-9 border border-rule bg-white text-ink-muted hover:text-ink text-xs font-medium rounded-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
