import crypto from 'crypto'

const CAPTCHA_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // excludes 0, O, 1, I, L
const CAPTCHA_TTL_MS = 10 * 60 * 1000 // 10 minutes

// Secret salt from server env
const SECRET_SALT = process.env.SUPABASE_SERVICE_ROLE_KEY || 'imidance-captcha-secure-salt-2026'

// In-memory cache for used tokens to prevent replay attacks (self-cleaning)
const usedTokens = new Map<string, number>()

// In-memory IP rate limiter: max 5 signups per 15 minutes per IP
const ipAttempts = new Map<string, { count: number; firstAttempt: number }>()
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS_PER_WINDOW = 5

function cleanCaches() {
  const now = Date.now()

  // Clean used tokens older than TTL
  for (const [token, timestamp] of usedTokens.entries()) {
    if (now - timestamp > CAPTCHA_TTL_MS) {
      usedTokens.delete(token)
    }
  }

  // Clean IP rate limits older than window
  for (const [ip, data] of ipAttempts.entries()) {
    if (now - data.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      ipAttempts.delete(ip)
    }
  }
}

// Run cleanup periodically
if (typeof setInterval !== 'undefined') {
  setInterval(cleanCaches, 5 * 60 * 1000)
}

export function checkIpRateLimit(ip: string): { allowed: boolean; remaining: number } {
  cleanCaches()
  const now = Date.now()
  const clientData = ipAttempts.get(ip)

  if (!clientData || now - clientData.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    ipAttempts.set(ip, { count: 1, firstAttempt: now })
    return { allowed: true, remaining: MAX_ATTEMPTS_PER_WINDOW - 1 }
  }

  if (clientData.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 }
  }

  clientData.count++
  return { allowed: true, remaining: MAX_ATTEMPTS_PER_WINDOW - clientData.count }
}

export function generateCaptchaSvg(text: string): string {
  const width = 190
  const height = 52

  // Background noise lines
  let lines = ''
  for (let i = 0; i < 5; i++) {
    const x1 = Math.floor(Math.random() * width)
    const y1 = Math.floor(Math.random() * height)
    const x2 = Math.floor(Math.random() * width)
    const y2 = Math.floor(Math.random() * height)
    const colors = ['#6366f1', '#a855f7', '#06b6d4', '#ec4899', '#64748b', '#3b82f6']
    const stroke = colors[Math.floor(Math.random() * colors.length)]
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.6" stroke-opacity="0.5"/>`
  }

  // Noise dots
  let dots = ''
  for (let i = 0; i < 25; i++) {
    const cx = Math.floor(Math.random() * width)
    const cy = Math.floor(Math.random() * height)
    const r = (Math.random() * 1.5 + 0.8).toFixed(1)
    dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#94a3b8" fill-opacity="0.4"/>`
  }

  // Text characters with random distortion
  let charElements = ''
  const charWidth = (width - 36) / text.length
  const textColors = ['#1e1b4b', '#312e81', '#1e293b', '#0f172a', '#3730a3', '#064e3b', '#4c1d95']

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const x = 20 + i * charWidth
    const y = 35 + (Math.random() * 6 - 3)
    const rotate = Math.floor(Math.random() * 36 - 18)
    const fill = textColors[Math.floor(Math.random() * textColors.length)]
    const fontSize = 28 + Math.floor(Math.random() * 4)

    charElements += `<text x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-family="Verdana, Arial, sans-serif" font-weight="900" transform="rotate(${rotate}, ${x}, ${y})">${ch}</text>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 10px; border: 1px solid #cbd5e1;">${dots}${lines}${charElements}</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function createCaptcha(): { token: string; svgDataUri: string } {
  let text = ''
  for (let i = 0; i < 5; i++) {
    text += CAPTCHA_CHARS.charAt(Math.floor(Math.random() * CAPTCHA_CHARS.length))
  }

  const timestamp = Date.now()
  const signature = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(`${text.toUpperCase()}:${timestamp}`)
    .digest('hex')

  const token = `${timestamp}:${signature}`
  const svgDataUri = generateCaptchaSvg(text)

  return { token, svgDataUri }
}

export function verifyCaptcha(token: string | undefined | null, answer: string | undefined | null): { valid: boolean; reason?: string } {
  if (!token || !answer) {
    return { valid: false, reason: 'Kérjük, add meg az ellenőrző kódot.' }
  }

  const parts = token.split(':')
  if (parts.length !== 2) {
    return { valid: false, reason: 'Érvénytelen ellenőrző token.' }
  }

  const [timestampStr, expectedSignature] = parts
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Érvénytelen időbélyeg a tokenben.' }
  }

  const now = Date.now()
  if (now - timestamp > CAPTCHA_TTL_MS) {
    return { valid: false, reason: 'Az ellenőrző kód lejárt. Kérjük, kérj új kódot.' }
  }
  if (timestamp > now + 60 * 1000) {
    return { valid: false, reason: 'Érvénytelen időbélyeg.' }
  }

  // Check if token was already used
  if (usedTokens.has(token)) {
    return { valid: false, reason: 'Ez az ellenőrző kód már fel lett használva. Kérj új kódot.' }
  }

  const cleanAnswer = answer.trim().toUpperCase()
  const computedSignature = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(`${cleanAnswer}:${timestamp}`)
    .digest('hex')

  if (computedSignature.length !== expectedSignature.length) {
    return { valid: false, reason: 'Helytelen ellenőrző kód. Kérjük, próbáld újra.' }
  }

  const bufA = new Uint8Array(Buffer.from(computedSignature, 'hex'))
  const bufB = new Uint8Array(Buffer.from(expectedSignature, 'hex'))
  const isMatch = crypto.timingSafeEqual(bufA, bufB)

  if (!isMatch) {
    return { valid: false, reason: 'Helytelen ellenőrző kód. Kérjük, próbáld újra.' }
  }

  // Mark token as used
  usedTokens.set(token, now)

  return { valid: true }
}
