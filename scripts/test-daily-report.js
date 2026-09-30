require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

async function testFullReportSend() {
  console.log('--- Starting End-to-End Test for Daily Report ---');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supabaseUrl, serviceKey);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false }
  });

  const now = new Date();
  const budapestDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const budapestTimeStr = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  // Fetch events
  const { data: events, error: evError } = await admin
    .from('events')
    .select('id, title, event_date, start_time, end_time, is_active, location_id, locations(id, name, address)')
    .neq('is_active', false)
    .order('event_date', { ascending: true });

  if (evError) throw evError;

  const toDateKey = (val) => (val ? String(val).split('T')[0] : '');
  const todayEvents = events.filter((ev) => toDateKey(ev.event_date) === budapestDateStr);
  const futureEvents = events.filter((ev) => toDateKey(ev.event_date) > budapestDateStr);
  const isTodayClass = todayEvents.length > 0;
  const focusEvent = isTodayClass ? todayEvents[0] : (futureEvents[0] || null);

  // Fetch profiles
  const { data: profiles, error: profError } = await admin
    .from('profiles')
    .select('id, name, full_name, first_name, last_name, gender, dance_level, partner_id, is_active')
    .neq('is_active', false);

  if (profError) throw profError;
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Focus event attendances
  let attendees = [];
  if (focusEvent) {
    const { data: atts } = await admin
      .from('attendances')
      .select('id, profile_id, status, created_at')
      .eq('event_id', focusEvent.id)
      .neq('status', 'cancelled');

    (atts || []).forEach(a => {
      const p = profileMap.get(a.profile_id);
      attendees.push({
        name: p?.full_name || p?.name || 'Ismeretlen',
        gender: p?.gender || '—',
        danceLevel: p?.dance_level || '—',
        registeredAt: a.created_at
      });
    });
  }

  const subject = `[ImiDance Riport] Napi jelentkezési összesítő - ${budapestDateStr} (${budapestTimeStr})`;
  const recipient = 'imredance@gmail.com';
  const cc = 'dkg11hu@gmail.com';

  console.log(`Sending test email to: ${recipient}, cc: ${cc}`);
  console.log(`Subject: ${subject}`);
  console.log(`Focus Event: ${focusEvent?.title || 'Táncóra'} (${focusEvent?.event_date}) - Attendees: ${attendees.length}`);

  const info = await transporter.sendMail({
    from: { name: 'ImiDance Riport', address: process.env.SMTP_USER || 'imitarsastanc@gmail.com' },
    to: recipient,
    cc: cc,
    subject: subject,
    html: `
      <div style="font-family: sans-serif; padding: 20px; background: #f8fafc; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #4338ca; margin-top: 0;">ImiDance Napi Jelentkezési Riport</h2>
          <p>Készült: <strong>${budapestDateStr} ${budapestTimeStr}</strong> (Budapesti idő)</p>
          <div style="background: #e0e7ff; padding: 12px; border-radius: 8px; margin: 16px 0;">
            <strong>Fókusz esemény:</strong> ${focusEvent?.title || 'Táncóra'} (${focusEvent?.event_date ? focusEvent.event_date.split('T')[0] : ''})<br>
            <strong>Eddigi jelentkezők:</strong> ${attendees.length} fő
          </div>
          <p style="font-size: 12px; color: #64748b;">
            Címzett: <strong>${recipient}</strong> • Másolat (CC): <strong>${cc}</strong><br>
            A részletes HTML riport sablon az éles ütemezett cronjob és a tesztelő felületen keresztül fut.
          </p>
        </div>
      </div>
    `
  });

  console.log('✅ Email sent successfully! MessageId:', info.messageId);
}

testFullReportSend().catch(err => {
  console.error('❌ Send error:', err);
  process.exit(1);
});
