'use client'

import { useState } from 'react'

const isValidEmail = (email?: string | null): boolean => {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export function EmailTester() {
  const [eventId, setEventId] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const [reportEmail, setReportEmail] = useState('imredance@gmail.com')
  const [reportCcEmail, setReportCcEmail] = useState('dkg11hu@gmail.com')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportStatus, setReportStatus] = useState<string | null>(null)

  async function handleSendDailyReport() {
    setReportLoading(true)
    setReportStatus(null)

    try {
      const ccParam = reportCcEmail.trim() ? `&cc=${encodeURIComponent(reportCcEmail.trim())}` : ''
      const url = `/api/cron/daily-report?force=true&to=${encodeURIComponent(reportEmail.trim())}${ccParam}`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()

      if (!res.ok || data.ok === false) {
        setReportStatus(`Hiba: ${data.error || 'A napi riport küldése sikertelen.'}`)
      } else {
        const ev = data.eventSummary
        const evInfo = ev ? `${ev.title} (${ev.date?.split('T')[0]}): ${ev.registeredCount} jelentkező` : 'Nincs kitűzött esemény'
        const ccInfo = data.cc ? ` | CC: ${data.cc}` : ''
        setReportStatus(
          `✅ Sikeres riport küldés! Címzett: ${data.recipient || reportEmail}${ccInfo} | ${evInfo} | MessageId: ${data.messageId || 'OK'}`
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Hálózati hiba'
      setReportStatus(`Hiba: ${msg}`)
    } finally {
      setReportLoading(false)
    }
  }

  async function handleSendTest() {
    if (!isValidEmail(testEmail)) {
      setStatus('Kérjük, adjon meg egy érvényes e-mail címet!')
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const res = await fetch('/api/notify-event-cancelled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          subject: '[TESZT] Teszt értesítés',
          body: 'Kedves {{nev}}!\n\nEz egy teszt üzenet.',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setStatus(`Hiba: ${data.error || 'A teszt e-mail küldése sikertelen.'}`)
      } else {
        setStatus(
          `Sikeres teszt! Kiküldve: ${data.sent?.length || 0}, Kihagyva (nincs e-mail): ${
            data.skipped_no_email?.length || 0
          }`
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Hálózati hiba'
      setStatus(`Hiba: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border border-zinc-200 rounded-2xl bg-white space-y-3 max-w-md">
      <h3 className="font-bold text-lg text-zinc-900">E-mail Tesztelő</h3>
      
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1">Esemény ID</label>
        <input
          type="text"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="pl. event-uuid-123"
          className="w-full p-2 border border-zinc-300 rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1">Teszt Címzett E-mail</label>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="pl. tancos@example.com"
          className="w-full p-2 border border-zinc-300 rounded-lg text-sm"
        />
      </div>

      <button
        onClick={handleSendTest}
        disabled={loading || !eventId || !isValidEmail(testEmail)}
        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Küldés...' : 'Teszt értesítés küldése'}
      </button>

      {status && (
        <div className="text-xs p-3 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-800 break-words font-mono">
          {status}
        </div>
      )}

      <hr className="border-zinc-200 my-4" />

      <div className="space-y-3 pt-1">
        <h4 className="font-bold text-sm text-zinc-900 flex items-center justify-between">
          <span>Napi 18:01 Riport Tesztelése</span>
          <span className="text-[10px] font-mono text-zinc-400 font-normal">Cron & Kézi</span>
        </h4>
        <p className="text-xs text-zinc-500">
          Azonnali tesztriport küldése a mai és következő órák adataival, nemi megoszlásával és az elmúlt 24 óra jelentkezéseivel.
        </p>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">Riport Címzett (To)</label>
          <input
            type="email"
            value={reportEmail}
            onChange={(e) => setReportEmail(e.target.value)}
            placeholder="imredance@gmail.com"
            className="w-full p-2 border border-zinc-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">Másolat Címzett (CC)</label>
          <input
            type="email"
            value={reportCcEmail}
            onChange={(e) => setReportCcEmail(e.target.value)}
            placeholder="dkg11hu@gmail.com"
            className="w-full p-2 border border-zinc-300 rounded-lg text-sm"
          />
        </div>

        <button
          onClick={handleSendDailyReport}
          disabled={reportLoading || !isValidEmail(reportEmail)}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {reportLoading ? 'Riport generálása és küldése...' : 'Napi Riport Küldése Most'}
        </button>

        {reportStatus && (
          <div className="text-xs p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 break-words font-mono">
            {reportStatus}
          </div>
        )}
      </div>
    </div>
  )
}