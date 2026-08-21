'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function EmailTester() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [members, setMembers] = useState<{ full_name: string; email: string }[]>([])

  // Valos email-cimu, nem letiltott tagok a gyorsvalasztohoz
  useEffect(() => {
    async function loadMembers() {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, is_active')
        .order('full_name')
      const list = (data || [])
        .filter((p: any) =>
          p.email &&
          !p.email.endsWith('@imisdance.local') &&
          p.is_active !== false
        )
        .map((p: any) => ({ full_name: p.full_name || p.email, email: p.email }))
      setMembers(list)
    }
    loadMembers()
  }, [])

  async function sendTest() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email })
      })
      const json = await res.json()
      setResult(json)
    } catch (e: any) {
      setResult({ error: e?.message || 'Hálózati hiba történt.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 bg-white border border-zinc-200 rounded-2xl space-y-3">
      <h3 className="font-bold text-zinc-900 text-base">SMTP E-mail tesztelése</h3>
      <p className="text-xs text-zinc-500">
        Próba levél küldése az események inaktiválása nélkül.
      </p>

      {/* Gyorsvalaszto: valos email-cimu tagok. A valasztas kitolti a mezot, de az szabadon atirhato. */}
      <select
        value=""
        onChange={e => { if (e.target.value) setEmail(e.target.value) }}
        className="w-full p-2 border border-zinc-300 rounded-lg text-sm bg-white cursor-pointer"
      >
        <option value="">— Tag választása a listából ({members.length}) —</option>
        {members.map(m => (
          <option key={m.email} value={m.email}>
            {m.full_name} ({m.email})
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <input
          type="email"
          placeholder="Címzett e-mail (üresen hagyva: SMTP_USER)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 p-2 border border-zinc-300 rounded-lg text-sm"
        />
        <button
          onClick={sendTest}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Küldés...' : 'Teszt levél küldése'}
        </button>
      </div>

      {result && (
        <div className={`p-3 rounded-lg text-xs font-mono ${result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {result.success ? (
            <p>Sikeres teszt! Levél elküldve ide: <strong>{result.recipient}</strong> (ID: {result.messageId})</p>
          ) : (
            <div className="space-y-1">
              <p className="font-bold">Sikertelen teszt:</p>
              <p>{result.error}</p>
              {result.code && <p>Kód: {result.code}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}