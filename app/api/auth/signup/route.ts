import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { getMailSender } from '@/lib/email';
import { verifyCaptcha, checkIpRateLimit } from '@/lib/captcha';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request: Request) {
  try {
    const {
      email,
      password,
      fullName,
      gender,
      danceLevel,
      captchaToken,
      captchaAnswer,
      honeypot
    } = await request.json();

    // 1. Bot honeypot check
    if (honeypot) {
      return NextResponse.json(
        { error: 'Automatizált kitöltés észlelve.' },
        { status: 400 }
      );
    }

    // 2. IP-based rate limiting (DDoS / automated flood mitigation)
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const clientIp = ip.split(',')[0].trim();

    const rateLimit = checkIpRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Túl sok regisztrációs kísérlet erről az IP címről. Kérjük, várj 15 percet az újabb próbálkozás előtt.' },
        { status: 429 }
      );
    }

    // 3. CAPTCHA verification
    const captchaCheck = verifyCaptcha(captchaToken, captchaAnswer);
    if (!captchaCheck.valid) {
      return NextResponse.json(
        { error: captchaCheck.reason || 'Helytelen vagy lejárt biztonsági kód.' },
        { status: 400 }
      );
    }

    // 4. Input validation
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'A hiányzó kötelező mezők miatt a regisztráció nem folytatható.' },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          gender,
          dance_level: danceLevel,
          privacy_accepted_at: new Date().toISOString(),
          privacy_accepted_ip: clientIp,
          privacy_accepted_version: 1, // Store that they accepted version 1
        },
        redirectTo: `${origin}/auth/confirm`,
      },
    });

    if (error || !data.properties?.hashed_token) {
      throw new Error(
        error?.message || 'Nem sikerült létrehozni a felhasználót és a megerősítő tokent.'
      );
    }

    const tokenHash = data.properties.hashed_token;
    const confirmUrl = `${origin}/auth/confirm?token_hash=${tokenHash}&type=signup`;

    await transporter.sendMail({
      from: getMailSender(),
      to: email,
      subject: 'Regisztráció megerősítése - ImiDance',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
          <h2 style="color: #18181b; margin-top: 0;">Üdvözlünk az ImiDance-ben!</h2>
          <p>Szia <strong>${fullName}</strong>!</p>
          <p>Köszönjük a regisztrációdat! A fiókod aktiválásához kattints az alábbi gombra:</p>
          <p style="margin: 24px 0;">
            <a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; background-color: #4f46e5; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Regisztráció megerősítése
            </a>
          </p>
          <p style="color: #71717a; font-size: 14px;">Ha a gomb nem működik, másold be az alábbi hivatkozást a böngésződbe:</p>
          <p style="word-break: break-all; font-size: 13px;"><a href="${confirmUrl}" style="color: #4f46e5;">${confirmUrl}</a></p>
        </div>
      `,
    });

    return NextResponse.json({
      message: 'Sikeres regisztráció! A megerősítő e-mailt elküldtük.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Belső szerverhiba történt a regisztráció során.' },
      { status: 500 }
    );
  }
}