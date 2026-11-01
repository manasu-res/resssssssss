import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { StaffRole } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['owner', 'waiter', 'kitchen'] as const),
});

const toggleStaffSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  isActive: z.boolean(),
});

export async function GET() {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const serviceSupabase = createServiceRoleClient();

    // Fetch profiles
    const { data: profiles, error: pError } = await serviceSupabase
      .from('profiles')
      .select('id, name, role, is_active, created_at')
      .order('created_at', { ascending: true });

    if (pError) throw pError;

    // Fetch auth users to map emails
    const { data: authUsers, error: uError } =
      await serviceSupabase.auth.admin.listUsers({ perPage: 100 });

    if (uError) throw uError;

    const emailMap = new Map<string, string>();
    authUsers.users.forEach(u => {
      if (u.email) emailMap.set(u.id, u.email);
    });

    const staffList = (profiles || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      is_active: p.is_active,
      created_at: p.created_at,
      email: emailMap.get(p.id) || '',
    }));

    return NextResponse.json({ staff: staffList });
  } catch (err: any) {
    console.error('Fetch staff error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch staff members.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parse = createStaffSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parse.data;
    const serviceSupabase = createServiceRoleClient();

    // 1. Create auth user with auto-confirmed email
    const { data: authUser, error: authErr } =
      await serviceSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      });

    if (authErr || !authUser.user) {
      return NextResponse.json(
        { error: authErr?.message || 'Failed to create auth user.' },
        { status: 400 }
      );
    }

    // 2. Insert into profiles table
    const { data: profile, error: pErr } = await (serviceSupabase as any)
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        name,
        role: role as StaffRole,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (pErr) {
      // Rollback auth user if profile insertion failed
      await serviceSupabase.auth.admin.deleteUser(authUser.user.id);
      throw pErr;
    }

    return NextResponse.json({
      success: true,
      staff: {
        ...profile,
        email,
      },
    });
  } catch (err: any) {
    console.error('Create staff error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create staff member.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { errorResponse, staff: currentOwner } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parse = toggleStaffSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { userId, isActive } = parse.data;

    // Prevent owner from deactivating themselves
    if (currentOwner?.userId === userId && !isActive) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own owner account.' },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    const { data: updatedProfile, error: pErr } = await (serviceSupabase as any)
      .from('profiles')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (pErr) throw pErr;

    return NextResponse.json({ success: true, staff: updatedProfile });
  } catch (err: any) {
    console.error('Update staff status error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update staff status.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { errorResponse, staff: currentOwner } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent owner from deleting their own account
    if (currentOwner?.userId === userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own owner account.' },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // 1. Delete from profiles table
    try {
      await (serviceSupabase as any)
        .from('profiles')
        .delete()
        .eq('id', userId);
    } catch (profErr) {
      console.warn('Error deleting profile row:', profErr);
    }

    // 2. Delete auth user so credentials cannot be used anymore
    try {
      await serviceSupabase.auth.admin.deleteUser(userId);
    } catch (authErr) {
      console.warn('Error deleting auth user:', authErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete staff error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete staff member.' },
      { status: 500 }
    );
  }
}
