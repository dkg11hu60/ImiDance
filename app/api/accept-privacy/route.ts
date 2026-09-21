import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId, version } = await request.json();

    if (!userId || !version) {
      return NextResponse.json(
        { error: 'Hiányzó felhasználó azonosító vagy verziószám.' },
        { status: 400 }
      );
    }

    // Retrieve the client IP address securely on the server
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Parse out potential proxy lists
    const clientIp = ip.split(',')[0].trim();

    // Update the profile using supabaseAdmin to bypass RLS and ensure successful logging
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        privacy_accepted_at: new Date().toISOString(),
        privacy_accepted_ip: clientIp,
        privacy_accepted_version: version,
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, ip: clientIp });
  } catch (error: any) {
    console.error('Privacy acceptance logging error:', error);
    return NextResponse.json(
      { error: error.message || 'Belső hiba történt a hozzájárulás rögzítése során.' },
      { status: 500 }
    );
  }
}