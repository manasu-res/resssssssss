import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Direct mobile ordering is currently disabled. Please place your order with your floor captain.' },
    { status: 403 }
  );
}
