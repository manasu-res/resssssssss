import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerStaffSession } from './session';
import type { StaffRole } from '@/lib/database.types';

export interface StaffAuthResult {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
}

const OWNER_EMAIL_DEFAULT = 'manasurestaurant@gmail.com';

function isOwnerUser(email?: string | null, metadataRole?: string | null): boolean {
  if (!email && !metadataRole) return false;
  const targetEmail = (process.env.OWNER_EMAIL || OWNER_EMAIL_DEFAULT).toLowerCase();
  const lower = email?.toLowerCase().trim();
  return (
    Boolean(lower && (lower === targetEmail || lower.includes('manasurestaurant') || lower.includes('owner'))) ||
    metadataRole === 'owner' ||
    metadataRole === 'admin'
  );
}

/**
 * Server guard for React Server Component pages (/admin, /waiter, /kitchen).
 * Checks session AND profile.
 * - If not logged in -> redirects to /login.
 * - If account inactive -> redirects to /login.
 * - If user role does not match allowedRoles:
 *     - If kitchen tries to visit /admin or /waiter -> redirects to /kitchen.
 *     - If waiter tries to visit /admin or /kitchen -> redirects to /waiter.
 *     - If owner is not allowed -> redirects to /admin.
 */
export async function requireStaffPageAuth(
  allowedRoles: StaffRole[]
): Promise<StaffAuthResult | 'NOT_ALLOWED'> {
  let effectiveRole: StaffRole | null = null;
  let authResult: StaffAuthResult | null = null;

  // 1. Check if staff session cookie exists (e.g. from /api/auth/login)
  try {
    const staffSession = await getServerStaffSession();
    if (staffSession) {
      effectiveRole = isOwnerUser(staffSession.email) ? 'owner' : staffSession.role;
      authResult = {
        userId: staffSession.userId,
        email: staffSession.email,
        name: staffSession.fullName,
        role: effectiveRole,
        isActive: true,
      };
    }
  } catch {
    // Continue to Supabase check
  }

  // 2. If no session cookie, check Supabase Auth Session
  if (!authResult) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isRealSupabase =
      url.startsWith('https://') &&
      !url.includes('demo') &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('demo');

    if (!isRealSupabase) {
      redirect('/login');
    }

    const supabase = createServerSupabaseClient();
    let user: any = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    } catch {
      // Failed to query user
    }

    if (!user) {
      redirect('/login');
    }

    const isOwner = isOwnerUser(user.email, user.user_metadata?.role);

    // 3. Fetch Profile from database
    let profile: { id: string; name: string; role: StaffRole; is_active: boolean } | null = null;
    try {
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('id, name, role, is_active')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData) {
        profile = profileData as any;
      }
    } catch {
      // Ignore error if database schema is initializing
    }

    // Fallback: If profile table is not initialized yet, but user is the owner
    if (!profile && isOwner) {
      profile = {
        id: user.id,
        name: user.user_metadata?.name || 'Owner',
        role: 'owner',
        is_active: true,
      };

      try {
        const serviceClient = createServiceRoleClient();
        await (serviceClient as any).from('profiles').upsert({
          id: user.id,
          name: user.user_metadata?.name || 'Owner',
          role: 'owner',
          is_active: true,
        });
      } catch {
        // Ignore if table does not exist
      }
    }

    if (!profile || !profile.is_active) {
      try {
        await supabase.auth.signOut();
      } catch {}
      redirect('/login');
    }

    effectiveRole =
      isOwner || profile.role === 'owner' || (profile.role as string) === 'admin'
        ? 'owner'
        : (profile.role as StaffRole);

    authResult = {
      userId: user.id,
      email: user.email || '',
      name: profile.name,
      role: effectiveRole,
      isActive: profile.is_active,
    };
  }

  // 4. Role enforcement & boundaries:
  if (!authResult || !effectiveRole) {
    redirect('/login');
  }

  // If user role is not permitted on this page, strictly bounce them back to their designated role portal
  if (!allowedRoles.includes(effectiveRole)) {
    if (effectiveRole === 'kitchen') {
      redirect('/kitchen');
    } else if (effectiveRole === 'waiter') {
      redirect('/waiter');
    } else if (effectiveRole === 'owner') {
      redirect('/admin');
    } else {
      return 'NOT_ALLOWED';
    }
  }

  return authResult;
}

/**
 * Server guard for Route Handlers (/api/admin/*, /api/waiter/*, /api/kitchen/*).
 * Returns an error Response if unauthorized/forbidden, or the authenticated staff profile.
 */
export async function verifyStaffApiRoute(
  allowedRoles: StaffRole[]
): Promise<{
  errorResponse: NextResponse | null;
  staff: StaffAuthResult | null;
}> {
  try {
    // 1. Check if staff session cookie exists
    try {
      const staffSession = await getServerStaffSession();
      if (staffSession) {
        const effectiveRole: StaffRole = isOwnerUser(staffSession.email) ? 'owner' : staffSession.role;
        if (allowedRoles.includes(effectiveRole)) {
          return {
            errorResponse: null,
            staff: {
              userId: staffSession.userId,
              email: staffSession.email,
              name: staffSession.fullName,
              role: effectiveRole,
              isActive: true,
            },
          };
        } else {
          // Strictly reject with 403 Forbidden - do NOT fall through to another session
          return {
            errorResponse: NextResponse.json(
              { error: 'Forbidden: You do not have permission for this resource.' },
              { status: 403 }
            ),
            staff: null,
          };
        }
      }
    } catch {
      // Continue to Supabase check
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isRealSupabase =
      url.startsWith('https://') &&
      !url.includes('demo') &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('demo');

    if (!isRealSupabase) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Authentication required. Please log in.' },
          { status: 401 }
        ),
        staff: null,
      };
    }

    const supabase = createServerSupabaseClient();
    let user: any = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    } catch {}

    if (!user) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Authentication required. Please log in.' },
          { status: 401 }
        ),
        staff: null,
      };
    }

    const isOwner = isOwnerUser(user.email, user.user_metadata?.role);

    let profile: { id: string; name: string; role: StaffRole; is_active: boolean } | null = null;
    try {
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('id, name, role, is_active')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData) {
        profile = profileData as any;
      }
    } catch {}

    if (!profile && isOwner) {
      profile = {
        id: user.id,
        name: user.user_metadata?.name || 'Owner',
        role: 'owner',
        is_active: true,
      };
    }

    if (!profile || !profile.is_active) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Staff account inactive or profile not found.' },
          { status: 403 }
        ),
        staff: null,
      };
    }

    const effectiveRole: StaffRole =
      isOwner || profile.role === 'owner' || (profile.role as string) === 'admin'
        ? 'owner'
        : (profile.role as StaffRole);

    if (!allowedRoles.includes(effectiveRole)) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Forbidden: You do not have permission for this resource.' },
          { status: 403 }
        ),
        staff: null,
      };
    }

    return {
      errorResponse: null,
      staff: {
        userId: user.id,
        email: user.email || '',
        name: profile.name,
        role: effectiveRole,
        isActive: profile.is_active,
      },
    };
  } catch (err: any) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Server authentication check failed.' },
        { status: 500 }
      ),
      staff: null,
    };
  }
}
