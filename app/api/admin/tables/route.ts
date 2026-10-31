import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

function generateUnguessableToken(): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `mnsu_tbl_${randomBytes}`;
}

const tableSchema = z.object({
  label: z.string().min(1, 'Table label is required'),
});

export async function GET() {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const serviceSupabase = createServiceRoleClient();
    const { data, error } = await serviceSupabase
      .from('dining_tables')
      .select('*')
      .order('label', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      return NextResponse.json({ tables: data });
    }
    throw new Error('No dining tables in database yet');
  } catch (err: any) {
    const tables = dbStore.tables.map(t => ({
      id: t.id,
      label: t.table_number.replace('Table ', ''),
      qr_token: t.active_token,
      is_enabled: t.is_active,
      created_at: t.created_at,
    }));
    return NextResponse.json({ tables });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parse = tableSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { label } = parse.data;
    const qrToken = generateUnguessableToken();
    const serviceSupabase = createServiceRoleClient();

    const { data, error } = await (serviceSupabase as any)
      .from('dining_tables')
      .insert({
        label: label.trim(),
        qr_token: qrToken,
        is_enabled: true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, table: data });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const newTbl = {
      id: `table-${Date.now()}`,
      label: body.label || 'New Table',
      qr_token: generateUnguessableToken(),
      is_enabled: true,
      created_at: new Date().toISOString(),
    };
    dbStore.tables.push({
      id: newTbl.id,
      table_number: newTbl.label,
      seat_capacity: 4,
      active_token: newTbl.qr_token,
      status: 'vacant',
      is_active: true,
      created_at: newTbl.created_at,
    });
    return NextResponse.json({ success: true, table: newTbl });
  }
}

export async function PATCH(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { id, action } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const serviceSupabase = createServiceRoleClient();

    if (action === 'reset_qr') {
      const newToken = generateUnguessableToken();
      const { data, error } = await (serviceSupabase as any)
        .from('dining_tables')
        .update({ qr_token: newToken })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, table: data });
    } else if (action === 'toggle_enabled') {
      const { isEnabled } = body;
      const { data, error } = await (serviceSupabase as any)
        .from('dining_tables')
        .update({ is_enabled: isEnabled })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, table: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const tbl = dbStore.tables.find(t => t.id === body.id);
    if (tbl) {
      if (body.action === 'reset_qr') {
        tbl.active_token = generateUnguessableToken();
      } else if (body.action === 'toggle_enabled') {
        tbl.is_active = body.isEnabled;
      }
    }
    return NextResponse.json({
      success: true,
      table: {
        id: tbl?.id,
        label: tbl?.table_number,
        qr_token: tbl?.active_token,
        is_enabled: tbl?.is_active,
      },
    });
  }
}

export async function DELETE(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const serviceSupabase = createServiceRoleClient();
    const { error } = await (serviceSupabase as any)
      .from('dining_tables')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    dbStore.tables = dbStore.tables.filter(t => t.id !== id);
    return NextResponse.json({ success: true });
  }
}
