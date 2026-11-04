import React from 'react';
import type { Metadata } from 'next';
import { requireStaffPageAuth } from '@/lib/auth/guard';
import { NotAllowed } from '@/components/auth/not-allowed';
import AdminClient from './admin-client';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Manasu Restaurant',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const auth = await requireStaffPageAuth(['owner']);

  if (auth === 'NOT_ALLOWED') {
    return <NotAllowed requiredRoles={['owner']} />;
  }

  return <AdminClient staff={auth} />;
}
