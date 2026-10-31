import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const serviceSupabase = createServiceRoleClient();
    const { data, error } = await serviceSupabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ categories: data || [] });
  } catch (err: any) {
    // Fallback to in-memory store
    const categories = dbStore.categories.sort((a, b) => a.sort_order - b.sort_order);
    return NextResponse.json({ categories });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parse = categorySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { name, sortOrder } = parse.data;
    const serviceSupabase = createServiceRoleClient();

    const { data, error } = await (serviceSupabase as any)
      .from('categories')
      .insert({
        name,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, category: data });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const newCat = {
      id: `cat-${Date.now()}`,
      name: body.name || 'New Category',
      sort_order: body.sortOrder || dbStore.categories.length + 1,
      is_active: true,
    };
    dbStore.categories.push(newCat as any);
    return NextResponse.json({ success: true, category: newCat });
  }
}

export async function PATCH(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { id, name, sortOrder } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const serviceSupabase = createServiceRoleClient();
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;

    const { data, error } = await (serviceSupabase as any)
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, category: data });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const cat = dbStore.categories.find(c => c.id === body.id);
    if (cat) {
      if (body.name !== undefined) cat.name = body.name;
      if (body.sortOrder !== undefined) cat.sort_order = body.sortOrder;
    }
    return NextResponse.json({ success: true, category: cat });
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
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    dbStore.categories = dbStore.categories.filter(c => c.id !== id);
    return NextResponse.json({ success: true });
  }
}
