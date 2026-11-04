import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 2MB size limit
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 2MB limit' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();
    const bucketName = 'restaurant-photos';

    // Ensure bucket exists
    try {
      const { data: buckets } = await serviceSupabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === bucketName)) {
        await serviceSupabase.storage.createBucket(bucketName, { public: true });
      }
    } catch {}

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { error: uploadErr } = await serviceSupabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      // Fallback: convert to base64 data URL for in-memory or small images
      const base64Url = `data:${file.type};base64,${buffer.toString('base64')}`;
      return NextResponse.json({ success: true, url: base64Url });
    }

    const { data: publicUrlData } = serviceSupabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
  } catch (err: any) {
    console.error('Photo upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
