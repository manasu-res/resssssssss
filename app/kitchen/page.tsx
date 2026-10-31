import React from 'react';
import { requireStaffPageAuth } from '@/lib/auth/guard';
import { NotAllowed } from '@/components/auth/not-allowed';
import KitchenClient from './kitchen-client';

export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const auth = await requireStaffPageAuth(['owner', 'kitchen', 'waiter']);

  if (auth === 'NOT_ALLOWED') {
    return <NotAllowed requiredRoles={['owner', 'kitchen']} />;
  }

  return <KitchenClient staff={auth} />;
}
