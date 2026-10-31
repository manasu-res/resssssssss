import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Logout error:', err);
  }

  const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = NextResponse.redirect(new URL('/login', origin), 303);
  res.cookies.delete('manasu_staff_session');
  return res;
}
