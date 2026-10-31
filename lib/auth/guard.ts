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
  return (
    Boolean(email && email.toLowerCase() === targetEmail) ||
    metadataRole === 'owner'
  );
}

/**
 * Server guard for React Server Component pages (/admin, /waiter, /kitchen).
 * Checks session AND profile.
 * - If not logged in -> redirects to /login.
 * - If account inactive -> redirects to /login.
 * - If role not allowed -> returns 'NOT_ALLOWED'.
 */
export async function requireStaffPageAuth(
  allowedRoles: StaffRole[]
): Promise<StaffAuthResult | 'NOT_ALLOWED'> {
  // 1. Check if staff session cookie exists (e.g. from /api/auth/login or fast switch)
  try {
    const staffSession = await getServerStaffSession();
    if (staffSession) {
      if (!allowedRoles.includes(staffSession.role)) {
        return 'NOT_ALLOWED';
      }
      return {
        userId: staffSession.userId,
        email: staffSession.email,
        name: staffSession.fullName,
        role: staffSession.role,
        isActive: true,
      };
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
    redirect('/login');
  }

  const supabase = createServerSupabaseClient();

  // 2. Check Supabase Auth Session
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

    // Attempt to upsert profile in background via service role
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

  // 4. Verify Role
  if (!allowedRoles.includes(profile.role as StaffRole)) {
    return 'NOT_ALLOWED';
  }

  return {
    userId: user.id,
    email: user.email || '',
    name: profile.name,
    role: profile.role as StaffRole,
    isActive: profile.is_active,
  };
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
        if (!allowedRoles.includes(staffSession.role)) {
          return {
            errorResponse: NextResponse.json(
              { error: 'Not allowed. You do not have permission for this action.' },
              { status: 403 }
            ),
            staff: null,
          };
        }
        return {
          errorResponse: null,
          staff: {
            userId: staffSession.userId,
            email: staffSession.email,
            name: staffSession.fullName,
            role: staffSession.role,
            isActive: true,
          },
        };
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

    if (!allowedRoles.includes(profile.role as StaffRole)) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Not allowed. You do not have permission for this action.' },
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
        role: profile.role as StaffRole,
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
