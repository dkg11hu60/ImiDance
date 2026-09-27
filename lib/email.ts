import nodemailer from 'nodemailer'

/**
 * Returns a standardized, RFC-5322 compliant sender object.
 * Uses pure ASCII for the display name to avoid MIME Q-encoding (=?UTF-8?Q?...?=) issues.
 */
export function getMailSender(subLabel?: string): { name: string; address: string } {
  const smtpUser = (process.env.SMTP_USER || 'imitarsastanc@gmail.com').trim()

  let address = smtpUser
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.includes('@')) {
    const match = process.env.SMTP_FROM.match(/<([^>]+)>/)
    address = match ? match[1].trim() : process.env.SMTP_FROM.trim()
  }

  const baseName = subLabel ? `ImiDance ${subLabel}` : 'ImiDance'
  // Keep ASCII only so mail clients don't apply MIME Q-encoding
  const asciiName = baseName.replace(/[^\x20-\x7E]/g, '').trim() || 'ImiDance'

  return {
    name: asciiName,
    address: address
  }
}

/**
 * Creates and returns a Nodemailer transporter using workspace SMTP settings.
 */
export function getMailTransporter() {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT) || 587
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpSecure = process.env.SMTP_SECURE === 'true'

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('Hiányzó SMTP konfiguráció a környezeti változókban (SMTP_HOST, SMTP_USER, SMTP_PASS).')
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false
    }
  })
}
