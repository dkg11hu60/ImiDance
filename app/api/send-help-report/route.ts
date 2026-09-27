import { NextResponse } from 'next/server'
import { getMailTransporter, getMailSender } from '@/lib/email'

const DEVELOPER_EMAIL = 'dkg11hu@gmail.com'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      description,
      userName,
      userEmail,
      userId,
      pageUrl,
      userAgent,
      screenResolution,
      consoleLogs,
      screenshot,
      consent
    } = body

    if (!consent) {
      return NextResponse.json({
        error: 'A küldéshez a felhasználói hozzájárulás megadása kötelező.'
      }, { status: 400 })
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({
        error: 'Kérjük, írd le röviden a tapasztalt problémát.'
      }, { status: 400 })
    }

    let transporter
    try {
      transporter = getMailTransporter()
    } catch (err: any) {
      return NextResponse.json({
        error: err.message || 'Hiányzó SMTP konfiguráció a szerveren.'
      }, { status: 500 })
    }

    const timestamp = new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' })
    const reporterName = userName || 'Névtelen látogató'
    const reporterEmail = userEmail || 'Nincs megadva'

    const attachments: any[] = []

    // Screenshot attachment
    if (screenshot && typeof screenshot === 'string' && screenshot.startsWith('data:image/')) {
      const match = screenshot.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/)
      if (match) {
        const mimeType = match[1]
        const ext = mimeType.split('/')[1] || 'png'
        const base64Data = match[2]
        attachments.push({
          filename: `kepernyofoto_${Date.now()}.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          cid: 'screenshot_attachment',
        })
      }
    }

    // Console dump attachment
    if (consoleLogs && typeof consoleLogs === 'string' && consoleLogs.trim()) {
      attachments.push({
        filename: `console_dump_${Date.now()}.txt`,
        content: Buffer.from(consoleLogs, 'utf-8'),
        contentType: 'text/plain; charset=utf-8',
      })
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: left;">
          <h2 style="margin: 0; font-size: 20px;">ImiDance - Hibabejelentés és Segítségkérés</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Dátum: ${timestamp}</p>
        </div>

        <div style="padding: 24px;">
          <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 15px; color: #0f172a;">Felhasználó által leírt probléma:</h3>
            <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #334155;">${escapeHtml(description)}</p>
          </div>

          <h3 style="font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; color: #0f172a;">Bejelentő adatai</h3>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 18px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Név:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(reporterName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>E-mail:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(reporterEmail)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Felhasználó azonosító (ID):</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(userId || 'Nem bejelentkezett')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Oldal URL:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;"><code>${escapeHtml(pageUrl || 'Ismeretlen')}</code></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Képernyőfelbontás:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(screenResolution || 'Ismeretlen')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Eszköz / Böngésző:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; word-break: break-all;">${escapeHtml(userAgent || 'Ismeretlen')}</td>
            </tr>
          </table>

          ${attachments.some(a => a.cid === 'screenshot_attachment') ? `
            <h3 style="font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; color: #0f172a;">Csatolt Képernyőkép</h3>
            <div style="margin: 12px 0; text-align: center;">
              <img src="cid:screenshot_attachment" alt="Csatolt hibakép" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #cbd5e1;" />
            </div>
          ` : '<p style="font-size: 13px; color: #94a3b8; font-style: italic;">Képernyőkép nem lett csatolva.</p>'}

          <h3 style="font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; color: #0f172a;">Konzol Diagnosztika (Utolsó események)</h3>
          <div style="background-color: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 11px; max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-all;">
            ${escapeHtml(consoleLogs ? consoleLogs.slice(-3000) : 'Nincsenek rögzített naplóbejegyzések.')}
          </div>
          ${consoleLogs && consoleLogs.length > 3000 ? '<p style="font-size: 11px; color: #64748b;">(A teljes napló elérhető a csatolt console_dump.txt fájlban)</p>' : ''}
        </div>

        <div style="background-color: #f1f5f9; padding: 12px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
          A felhasználó kifejezetten hozzájárult a fenti adatok elküldéséhez a hibaelhárítás céljából.
        </div>
      </div>
    `

    const sender = getMailSender('Help')

    await transporter.sendMail({
      from: sender,
      to: DEVELOPER_EMAIL,
      replyTo: userEmail || undefined,
      subject: `[ImiDance Hibabejelentes] - ${reporterName} (${timestamp})`,
      html: htmlContent,
      attachments: attachments
    })

    return NextResponse.json({ ok: true, message: 'Hibajelentés sikeresen elküldve.' })
  } catch (err: any) {
    console.error('[SEND-HELP-REPORT ERROR]:', err)
    return NextResponse.json({
      error: err?.message || 'Hiba történt a hibajelentés küldése közben.'
    }, { status: 500 })
  }
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
