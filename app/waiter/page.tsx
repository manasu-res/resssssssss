import React from 'react';
import { requireStaffPageAuth } from '@/lib/auth/guard';
import { NotAllowed } from '@/components/auth/not-allowed';
import WaiterClient from './waiter-client';

export const dynamic = 'force-dynamic';

export default async function WaiterPage() {
  const auth = await requireStaffPageAuth(['owner', 'waiter']);

  if (auth === 'NOT_ALLOWED') {
    return <NotAllowed requiredRoles={['owner', 'waiter']} />;
  }

  return <WaiterClient staff={auth} />;
}
