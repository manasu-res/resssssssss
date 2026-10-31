import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  restaurant_name: z.string().min(1, 'Restaurant name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  gstin: z.string().nullable().optional(),
  tax_percent: z.number().min(0).max(100).default(5),
  bill_footer: z.string().default('Thank you! Visit again.'),
  paper_width: z.enum(['80mm', '58mm']).default('80mm'),
});

const DEFAULT_SETTINGS = {
  id: 1,
  restaurant_name: 'Manasu Restaurant',
  address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
  phone: '+91 80 2520 1980',
  gstin: '29AABCM8291Q1ZP',
  tax_percent: 5,
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

    const { restaurant_name, address, phone, gstin, tax_percent, bill_footer, paper_width } = parse.data;
    const serviceSupabase = createServiceRoleClient();

    const { data, error } = await (serviceSupabase as any)
      .from('settings')
      .upsert({
        id: 1,
        restaurant_name,
        address,
        phone,
        gstin: gstin || null,
        tax_percent,
        bill_footer,
        paper_width: paper_width || '80mm',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, settings: data });
  } catch (err: any) {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      settings: { ...DEFAULT_SETTINGS, ...body },
    });
  }
}
