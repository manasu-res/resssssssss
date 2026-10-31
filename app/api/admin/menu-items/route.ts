import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

const menuItemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Item name is required'),
  description: z.string().default(''),
  pricePaise: z.number().int().min(0, 'Price must be non-negative'),
  isVeg: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const serviceSupabase = createServiceRoleClient();
    const { data, error } = await serviceSupabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (err: any) {
    const items = dbStore.items.map(i => ({
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description,
      price: i.price_paise,
      is_veg: i.dietary === 'veg',
      is_available: i.is_available,
      sort_order: i.sort_order,
    }));
    return NextResponse.json({ items });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parse = menuItemSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { categoryId, name, description, pricePaise, isVeg, isAvailable, sortOrder } = parse.data;
    const serviceSupabase = createServiceRoleClient();

    const { data, error } = await (serviceSupabase as any)
      .from('menu_items')
      .insert({
        category_id: categoryId,
        name,
        description,
        price: pricePaise,
        is_veg: isVeg,
        is_available: isAvailable,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const newItem = {
      id: `item-${Date.now()}`,
      category_id: body.categoryId,
      name: body.name,
      description: body.description || '',
      price: body.pricePaise || 0,
      is_veg: body.isVeg ?? true,
      is_available: body.isAvailable ?? true,
      sort_order: body.sortOrder || dbStore.items.length + 1,
    };
    dbStore.items.push({
      id: newItem.id,
      category_id: newItem.category_id,
      name: newItem.name,
      description: newItem.description,
      price_paise: newItem.price,
      dietary: newItem.is_veg ? 'veg' : 'non_veg',
      is_available: newItem.is_available,
      sort_order: newItem.sort_order,
    });
    return NextResponse.json({ success: true, item: newItem });
  }
}

export async function PATCH(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { id, isAvailable, name, pricePaise, isVeg, description, sortOrder } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const serviceSupabase = createServiceRoleClient();
    const updateData: any = {};
    if (isAvailable !== undefined) updateData.is_available = isAvailable;
    if (name !== undefined) updateData.name = name;
    if (pricePaise !== undefined) updateData.price = pricePaise;
    if (isVeg !== undefined) updateData.is_veg = isVeg;
    if (description !== undefined) updateData.description = description;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;

    const { data, error } = await (serviceSupabase as any)
      .from('menu_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Keep in-memory dbStore synchronized as well
    const memItem = dbStore.items.find(i => i.id === id);
    if (memItem) {
      if (isAvailable !== undefined) memItem.is_available = isAvailable;
      if (name !== undefined) memItem.name = name;
      if (pricePaise !== undefined) memItem.price_paise = pricePaise;
      if (isVeg !== undefined) memItem.dietary = isVeg ? 'veg' : 'non_veg';
      if (description !== undefined) memItem.description = description;
      if (sortOrder !== undefined) memItem.sort_order = sortOrder;
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const item = dbStore.items.find(i => i.id === body.id);
    if (item) {
      if (body.isAvailable !== undefined) item.is_available = body.isAvailable;
      if (body.name !== undefined) item.name = body.name;
      if (body.pricePaise !== undefined) item.price_paise = body.pricePaise;
      if (body.isVeg !== undefined) item.dietary = body.isVeg ? 'veg' : 'non_veg';
      if (body.description !== undefined) item.description = body.description;
      if (body.sortOrder !== undefined) item.sort_order = body.sortOrder;
    }
    return NextResponse.json({ success: true, item });
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
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    dbStore.items = dbStore.items.filter(i => i.id !== id);
    return NextResponse.json({ success: true });
  }
}
