import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { StaffRole } from '@/lib/database.types';

export interface StaffAuthResult {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
}

/**
 * Server guard for React Server Component pages (/admin, /waiter, /kitchen).
 * Checks session AND profile in Supabase.
 * - If not logged in -> redirects to /login.
 * - If account inactive -> redirects to /login.
 * - If role not allowed -> returns null so the page can render the plain "Not allowed" view.
 */
export async function requireStaffPageAuth(
  allowedRoles: StaffRole[]
): Promise<StaffAuthResult | 'NOT_ALLOWED'> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isRealSupabase =
    url.startsWith('https://') &&
    !url.includes('demo') &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('demo');

  if (!isRealSupabase) {
    // Local development fallback
    const { getServerStaffSession } = await import('./session');
    const devSession = await getServerStaffSession();
    if (!devSession) {
      redirect('/login');
    }
    if (!allowedRoles.includes(devSession.role)) {
      return 'NOT_ALLOWED';
    }
    return {
      userId: devSession.userId,
      email: devSession.email,
      name: devSession.fullName,
      role: devSession.role,
      isActive: true,
    };
  }

  const supabase = createServerSupabaseClient();

  // 1. Check Auth Session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // 2. Fetch Profile from database
  const { data: profileData, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('id, name, role, is_active')
    .eq('id', user.id)
    .single();

  const profile = profileData as { id: string; name: string; role: StaffRole; is_active: boolean } | null;

  if (profileError || !profile || !profile.is_active) {
    // If user has no active staff profile, sign them out and redirect to login
    await supabase.auth.signOut();
    redirect('/login');
  }

  // 3. Verify Role
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
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isRealSupabase =
      url.startsWith('https://') &&
      !url.includes('demo') &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('demo');

    if (!isRealSupabase) {
      const { getServerStaffSession } = await import('./session');
      const devSession = await getServerStaffSession();
      if (!devSession) {
        return {
          errorResponse: NextResponse.json(
            { error: 'Authentication required. Please log in.' },
            { status: 401 }
          ),
          staff: null,
        };
      }
      if (!allowedRoles.includes(devSession.role)) {
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
          userId: devSession.userId,
          email: devSession.email,
          name: devSession.fullName,
          role: devSession.role,
          isActive: true,
        },
      };
    }

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Authentication required. Please log in.' },
          { status: 401 }
        ),
        staff: null,
      };
    }

    const { data: profileData, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('id, name, role, is_active')
      .eq('id', user.id)
      .single();

    const profile = profileData as { id: string; name: string; role: StaffRole; is_active: boolean } | null;

    if (profileError || !profile || !profile.is_active) {
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
