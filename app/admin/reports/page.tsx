import React from 'react';
import { requireStaffPageAuth } from '@/lib/auth/guard';
import { NotAllowed } from '@/components/auth/not-allowed';
import AdminClient from '../admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const auth = await requireStaffPageAuth(['owner']);

  if (auth === 'NOT_ALLOWED') {
    return <NotAllowed requiredRoles={['owner']} />;
  }

  return <AdminClient staff={auth} initialTab="reports" />;
}
