import { NextResponse } from 'next/server'
import { createCaptcha } from '@/lib/captcha'

export async function GET() {
  try {
    const { token, svgDataUri } = createCaptcha()

    return NextResponse.json(
      { ok: true, token, svgDataUri },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Nem sikerült az ellenőrző kódot legenerálni.' },
      { status: 500 }
    )
  }
}
