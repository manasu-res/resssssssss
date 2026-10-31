import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        const { data: categories, error: catErr } = await (supabase as any)
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true });

        const { data: items, error: itemErr } = await (supabase as any)
          .from('menu_items')
          .select('*')
          .order('sort_order', { ascending: true });

        const { data: combos, error: comboErr } = await (supabase as any)
          .from('combos')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!itemErr && items && items.length > 0) {
          return NextResponse.json({
            categories: (categories && categories.length > 0) ? categories : dbStore.categories.map(c => ({
              id: c.id,
              name: c.name,
              sort_order: c.sort_order,
            })),
            items: items.map((i: any) => ({
              ...i,
              price: i.price ?? i.price_paise ?? 0,
              price_paise: i.price ?? i.price_paise ?? 0,
              is_veg: i.is_veg ?? (i.dietary === 'veg'),
              dietary: i.dietary || (i.is_veg ? 'veg' : 'non_veg'),
            })),
            combos: (combos || []).map((c: any) => ({
              ...c,
              price: c.price ?? c.price_paise ?? 0,
              price_paise: c.price ?? c.price_paise ?? 0,
              is_veg: c.is_veg ?? (c.dietary === 'veg'),
              dietary: c.dietary || (c.is_veg ? 'veg' : 'non_veg'),
            })),
          });
        }
      } catch (sbErr) {
        console.warn('Supabase menu fetch error, falling back to dbStore:', sbErr);
      }
    }

    // High-reliability Fallback (dbStore)
    return NextResponse.json({
      categories: dbStore.categories.map(c => ({
        id: c.id,
        name: c.name,
        sort_order: c.sort_order,
      })),
      items: dbStore.items.map(i => ({
        id: i.id,
        category_id: i.category_id,
        name: i.name,
        description: i.description,
        price: i.price_paise,
        price_paise: i.price_paise,
        is_veg: i.dietary === 'veg',
        dietary: i.dietary,
        is_available: i.is_available,
      })),
      combos: dbStore.combos.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        price: c.price_paise,
        price_paise: c.price_paise,
        is_veg: c.dietary === 'veg',
        dietary: c.dietary,
        is_available: c.is_available,
      })),
    });
  } catch (err: any) {
    console.error('Waiter menu fetch error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch menu' },
      { status: 500 }
    );
  }
}
