import { NextRequest, NextResponse } from 'next/server';
import { staffLoginSchema } from '@/lib/validation';
import { dbStore } from '@/lib/data/store';
import { getServiceSupabase } from '@/lib/supabase/service';
import { StaffRole } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = staffLoginSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Please enter valid email and password' }, { status: 400 });
    }

    const { email, password } = parse.data;
    const lowerEmail = email.toLowerCase().trim();
    const isOwnerEmail =
      lowerEmail === (process.env.OWNER_EMAIL || 'manasurestaurant@gmail.com').toLowerCase();

    const supabase = getServiceSupabase();

    if (supabase) {
      // Authenticate with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: lowerEmail,
        password,
      });

      if (authErr || !authData.user) {
        return NextResponse.json({ error: authErr?.message || 'Invalid staff credentials' }, { status: 401 });
      }

      // Query staff profile for role
      let role: StaffRole = isOwnerEmail ? 'owner' : 'waiter';
      let fullName = isOwnerEmail ? 'Owner' : 'Staff Member';

      try {
        const { data: profile, error: profErr } = await (supabase as any)
          .from('profiles')
          .select('name, role, is_active')
          .eq('id', authData.user.id)
          .single();

        if (!profErr && profile) {
          if (!profile.is_active) {
            return NextResponse.json({ error: 'Staff account has been deactivated' }, { status: 403 });
          }
          role = profile.role as StaffRole;
          fullName = profile.name || fullName;
        } else if (!isOwnerEmail) {
          return NextResponse.json({ error: 'Staff profile not found. Contact the owner.' }, { status: 403 });
        }
      } catch {
        if (!isOwnerEmail) {
          return NextResponse.json({ error: 'Staff account check failed' }, { status: 403 });
        }
      }

      const sessionData = {
        userId: authData.user.id,
        email: lowerEmail,
        fullName,
        role,
      };

      const res = NextResponse.json({
        success: true,
        session: sessionData,
        redirectTo: getRedirectUrl(role),
      });

      res.cookies.set('manasu_staff_session', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return res;
    } else {
      // Demo / Standalone fallback login
      let matchedStaff = dbStore.staff.find(s => {
        if (lowerEmail.includes('owner') || lowerEmail.includes('admin') || lowerEmail.includes('manasu')) return s.role === 'owner';
        if (lowerEmail.includes('kitchen') || lowerEmail.includes('chef')) return s.role === 'kitchen';
        if (lowerEmail.includes('waiter') || lowerEmail.includes('ramesh')) return s.role === 'waiter';
        return false;
      });

      if (!matchedStaff) {
        matchedStaff = dbStore.staff[0]; // Owner default
      }

      const sessionData = {
        userId: matchedStaff.id,
        email: lowerEmail,
        fullName: matchedStaff.full_name,
        role: matchedStaff.role,
      };

      const res = NextResponse.json({
        success: true,
        session: sessionData,
        redirectTo: getRedirectUrl(matchedStaff.role),
      });

      res.cookies.set('manasu_staff_session', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return res;
    }
  } catch (err: any) {
    console.error('Staff login error:', err);
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}

function getRedirectUrl(role: StaffRole): string {
  switch (role) {
    case 'owner':
      return '/admin';
    case 'kitchen':
      return '/kitchen';
    case 'waiter':
    default:
      return '/waiter';
  }
}
