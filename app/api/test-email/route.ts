import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const targetEmail = body.to || process.env.SMTP_USER

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = Number(process.env.SMTP_PORT) || 587
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpSecure = process.env.SMTP_SECURE === 'true'
    const fromEmail = process.env.SMTP_FROM || smtpUser

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({
        error: 'Hiányzó SMTP konfiguráció a .env.local fájlban (SMTP_HOST, SMTP_USER, SMTP_PASS).'
      }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // SSL/TLS kézfogási hibák elkerülése teszt környezetben
      tls: {
        rejectUnauthorized: false
      }
    })

    // 1. SMTP kapcsolat ellenőrzése
    await transporter.verify()

    // 2. Teszt levél kiküldése
    const info = await transporter.sendMail({
      from: `"ImiDance Teszt" <${fromEmail}>`,
      to: targetEmail,
      subject: 'ImiDance - SMTP Teszt E-mail',
      text: 'Ez egy teszt üzenet az ImiDance rendszertől. Az SMTP beállítások megfelelően működnek!',
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      recipient: targetEmail
    })
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Ismeretlen hiba történt az SMTP teszt során.',
      code: err?.code,
      command: err?.command
    }, { status: 500 })
  }
}