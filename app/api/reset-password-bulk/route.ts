import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

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
    const { emails } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'A tömb típusú e-mail lista megadása kötelező.' },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';

    const results = {
      successful: [] as string[],
      failed: [] as { email: string; error: string }[],
    };

    for (const email of emails) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: {
            redirectTo: `${origin}/reset-password`,
          },
        });

        if (error || !data.properties?.hashed_token) {
          throw new Error(
            error?.message || 'Nem sikerült legenerálni a recovery tokent.'
          );
        }

        const tokenHash = data.properties.hashed_token;
        const resetUrl = `${origin}/reset-password?token_hash=${tokenHash}&type=recovery`;

        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'Jelszó visszaállítása - ImiDance',
          html: `
            <div style="font-family: sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
              <h2 style="color: #18181b; margin-top: 0;">Jelszó visszaállítása</h2>
              <p>Szia!</p>
              <p>Új jelszó megadásához az ImiDance fiókodhoz kattints az alábbi gombra:</p>
              <p style="margin: 24px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; background-color: #4f46e5; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Új jelszó megadása
                </a>
              </p>
              <p style="color: #71717a; font-size: 14px;">Ha a gomb nem működik, másold be az alábbi hivatkozást a böngésződbe:</p>
              <p style="word-break: break-all; font-size: 13px;"><a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a></p>
            </div>
          `,
        });

        results.successful.push(email);
      } catch (err: any) {
        results.failed.push({
          email,
          error: err.message || 'Ismeretlen hiba történt.',
        });
      }
    }

    return NextResponse.json({
      message: 'Tömeges jelszó-visszaállítás befejeződött.',
      summary: {
        total: emails.length,
        successCount: results.successful.length,
        failCount: results.failed.length,
      },
      details: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Belső szerverhiba történt.' },
      { status: 500 }
    );
  }
}