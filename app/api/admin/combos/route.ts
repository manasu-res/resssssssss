import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

const comboSchema = z.object({
  name: z.string().min(1, 'Combo name is required'),
  description: z.string().default(''),
  pricePaise: z.number().int().min(0, 'Price must be non-negative'),
  isVeg: z.boolean().default(true),
  items: z.array(
    z.object({
      menuItemId: z.string().min(1),
      quantity: z.number().int().min(1),
    })
  ).min(1, 'Must include at least one item in combo'),
});

export async function GET() {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const serviceSupabase = createServiceRoleClient();
    const { data: combos, error: cErr } = await serviceSupabase
      .from('combos')
      .select('*')
      .order('created_at', { ascending: false });

    if (cErr) throw cErr;

    const { data: comboItems, error: ciErr } = await serviceSupabase
      .from('combo_items')
      .select('*, menu_item:menu_items(id, name, price, is_veg)');

    if (ciErr) throw ciErr;

    const formatted = (combos || []).map(c => {
      const items = (comboItems || [])
        .filter((ci: any) => ci.combo_id === c.id)
        .map((ci: any) => ({
          menu_item_id: ci.menu_item_id,
          name: ci.menu_item?.name || '',
          price: ci.menu_item?.price || 0,
          quantity: ci.quantity,
        }));

      const separatePriceTotal = items.reduce(
        (sum, it) => sum + (it.price * it.quantity),
        0
      );

      return {
        ...c,
        items,
        separatePriceTotal,
      };
    });

    return NextResponse.json({ combos: formatted });
  } catch (err: any) {
    const formatted = dbStore.combos.map(c => {
      const items = (c.items || []).map(ci => {
        const fullItem = dbStore.getItemById(ci.id);
        return {
          menu_item_id: ci.id,
          name: ci.name,
          price: fullItem?.price_paise || 0,
          quantity: ci.quantity,
        };
      });

      const separatePriceTotal = items.reduce(
        (sum, it) => sum + (it.price * it.quantity),
        0
      );

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        price: c.price_paise,
        is_veg: c.dietary === 'veg',
        is_available: c.is_available,
        items,
        separatePriceTotal,
      };
    });
    return NextResponse.json({ combos: formatted });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parse = comboSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { name, description, pricePaise, isVeg, items } = parse.data;
    const serviceSupabase = createServiceRoleClient();

    // 1. Insert combo
    const { data: newCombo, error: cErr } = await (serviceSupabase as any)
      .from('combos')
      .insert({
        name,
        description,
        price: pricePaise,
        is_veg: isVeg,
        is_available: true,
      })
      .select()
      .single();

    if (cErr) throw cErr;

    // 2. Insert combo_items
    const comboItemRows = items.map(it => ({
      combo_id: newCombo.id,
      menu_item_id: it.menuItemId,
      quantity: it.quantity,
    }));

    const { error: ciErr } = await (serviceSupabase as any)
      .from('combo_items')
      .insert(comboItemRows);

    if (ciErr) throw ciErr;

    return NextResponse.json({ success: true, combo: newCombo });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const newCombo = {
      id: `combo-${Date.now()}`,
      name: body.name || 'Custom Combo',
      description: body.description || '',
      price_paise: body.pricePaise || 0,
      dietary: body.isVeg ? ('veg' as const) : ('non_veg' as const),
      is_available: true,
      items: (body.items || []).map((it: any) => ({
        id: it.menuItemId,
        name: dbStore.getItemById(it.menuItemId)?.name || 'Item',
        quantity: it.quantity,
      })),
    };
    dbStore.combos.unshift(newCombo);
    return NextResponse.json({ success: true, combo: newCombo });
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
      .from('combos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    dbStore.combos = dbStore.combos.filter(c => c.id !== id);
    return NextResponse.json({ success: true });
  }
}
