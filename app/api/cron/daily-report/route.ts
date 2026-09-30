import { NextResponse } from 'next/server'
import { generateAndSendDailyReport } from '@/lib/dailyReport'

export const runtime = 'nodejs'

async function handleReportRequest(req: Request) {
  try {
    const url = new URL(req.url)
    const force = url.searchParams.get('force') === 'true'
    const to = url.searchParams.get('to') || undefined
    const cc = url.searchParams.get('cc') || undefined
    const key = url.searchParams.get('key')
    const authHeader = req.headers.get('authorization')

    // Optional Vercel CRON_SECRET verification
    const cronSecret = process.env.CRON_SECRET
    if (
      cronSecret &&
      authHeader !== `Bearer ${cronSecret}` &&
      key !== cronSecret &&
      process.env.NODE_ENV === 'production' &&
      !force
    ) {
      return NextResponse.json({ error: 'Unauthorized (invalid CRON_SECRET).' }, { status: 401 })
    }

    const result = await generateAndSendDailyReport({
      force,
      recipientOverride: to,
      ccOverride: cc,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[DAILY-REPORT-CRON ERROR]:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Ismeretlen hiba történt a napi riport generálása során.',
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  return handleReportRequest(req)
}

export async function POST(req: Request) {
  return handleReportRequest(req)
}
