import { cookies } from 'next/headers';
import { StaffRole } from '../types';

export interface StaffAuthSession {
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
}

export async function getServerStaffSession(): Promise<StaffAuthSession | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('manasu_staff_session');

  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  try {
    const session = JSON.parse(sessionCookie.value) as StaffAuthSession;
    if (session && session.role && ['owner', 'waiter', 'kitchen'].includes(session.role)) {
      return session;
    }
  } catch {
    return null;
  }

  return null;
}

export async function requireStaffRole(allowedRoles: StaffRole[]): Promise<StaffAuthSession> {
  const session = await getServerStaffSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  if (!allowedRoles.includes(session.role)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}
