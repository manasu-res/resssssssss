import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  restaurant_name: z.string().min(1, 'Restaurant name is required'),
  address: z.string().default(''),
  phone: z.string().default(''),
  tagline: z.string().optional().default(''),
  about_text: z.string().optional().default(''),
  opening_hours: z.string().optional().default(''),
  maps_url: z.string().optional().default(''),
  photos: z.array(z.string()).max(6).optional().default([]),
  large_order_threshold_paise: z.number().int().min(0).default(500000),
  gstin: z.string().nullable().optional(),
  tax_percent: z.number().min(0).max(100).default(0),
  bill_footer: z.string().default('Thank you! Visit again.'),
  paper_width: z.enum(['80mm', '58mm']).default('80mm'),
});

const DEFAULT_SETTINGS = {
  id: 1,
  restaurant_name: 'Manasu Restaurant',
  address: '',
  phone: '',
  tagline: 'Pure Vegetarian South Indian Cuisine',
  about_text: '',
  opening_hours: '',
  maps_url: '',
  photos: [] as string[],
  large_order_threshold_paise: 500000,
  gstin: '',
  tax_percent: 0,
  bill_footer: 'Thank you for dining at Manasu! Visit again.',
  paper_width: '80mm',
};

export async function GET() {
  const { errorResponse } = await verifyStaffApiRoute(['owner', 'waiter', 'kitchen']);
  if (errorResponse) return errorResponse;

  try {
    const serviceSupabase = createServiceRoleClient();
    const { data, error } = await serviceSupabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ settings: data || DEFAULT_SETTINGS });
  } catch (err: any) {
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parse = settingsSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const {
      restaurant_name,
      address,
      phone,
      tagline,
      about_text,
      opening_hours,
      maps_url,
      photos,
      large_order_threshold_paise,
      gstin,
      tax_percent,
      bill_footer,
      paper_width,
    } = parse.data;
    const serviceSupabase = createServiceRoleClient();

    const { data, error } = await (serviceSupabase as any)
      .from('settings')
      .upsert({
        id: 1,
        restaurant_name,
        address,
        phone,
        tagline: tagline || '',
        about_text: about_text || '',
        opening_hours: opening_hours || '',
        maps_url: maps_url || '',
        photos: photos || [],
        large_order_threshold_paise: large_order_threshold_paise || 500000,
        gstin: gstin || null,
        tax_percent,
        bill_footer,
        paper_width: paper_width || '80mm',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Sync in-memory store
    dbStore.settings = { ...DEFAULT_SETTINGS, ...data };

    return NextResponse.json({ success: true, settings: data });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    const updated = { ...DEFAULT_SETTINGS, ...body };
    dbStore.settings = updated;
    return NextResponse.json({
      success: true,
      settings: updated,
    });
  }
}
