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
    </div>
  )
}