import { NextRequest, NextResponse } from 'next/server';
import { menuItemSchema } from '@/lib/validation';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    if (session && session.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: categories } = await supabase
        .from('menu_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .order('sort_order', { ascending: true });

      return NextResponse.json({
        categories: categories || [],
        items: items || [],
      });
    } else {
      return NextResponse.json({
        categories: dbStore.categories,
        items: dbStore.items,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && session.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const body = await req.json();
    const itemId = body.id; // optional if edit

    const parse = menuItemSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { categoryId, name, description, pricePaise, dietary, isAvailable, sortOrder } = parse.data;
    const supabase = getServiceSupabase();

    if (supabase) {
      if (itemId) {
        const { data: updated, error } = await supabase
          .from('menu_items')
          .update({
            category_id: categoryId,
            name,
            description,
            price_paise: pricePaise,
            dietary,
            is_available: isAvailable,
            sort_order: sortOrder,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, item: updated });
      } else {
        const { data: created, error } = await supabase
          .from('menu_items')
          .insert({
            category_id: categoryId,
            name,
            description,
            price_paise: pricePaise,
            dietary,
            is_available: isAvailable,
            sort_order: sortOrder,
          })
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, item: created });
      }
    } else {
      if (itemId) {
        const existing = dbStore.items.find(i => i.id === itemId);
        if (existing) {
          existing.category_id = categoryId;
          existing.name = name;
          existing.description = description;
          existing.price_paise = pricePaise;
          existing.dietary = dietary;
          existing.is_available = isAvailable;
          existing.sort_order = sortOrder;
        }
        return NextResponse.json({ success: true, item: existing });
      } else {
        const newItem = {
          id: `item-${Date.now()}`,
          category_id: categoryId,
          name,
          description,
          price_paise: pricePaise,
          dietary,
          is_available: isAvailable,
          sort_order: sortOrder,
        };
        dbStore.items.push(newItem);
        return NextResponse.json({ success: true, item: newItem });
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save menu item' }, { status: 500 });
  }
}
