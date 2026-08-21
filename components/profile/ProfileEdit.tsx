'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PolicyViewer } from '../policy/PolicyViewer'

interface ProfileEditProps {
  userId: string
  onSave?: () => void
}

export function ProfileEdit({ userId, onSave }: ProfileEditProps) {
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<'Fiú' | 'Lány'>('Fiú')
  const [danceLevel, setDanceLevel] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [availablePartners, setAvailablePartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Jelszó-módosítás külön állapota
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [profileRes, partnersRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          supabase.from('profiles').select('*').neq('id', userId).order('full_name')
        ])

        if (profileRes.error) throw profileRes.error

        const data = profileRes.data
        if (data) {
          setFullName(data.full_name || '')
          setGender(data.gender || 'Fiú')
          setDanceLevel(data.dance_level || '')
          setPartnerId(data.partner_id || '')
        }
        if (partnersRes.data) setAvailablePartners(partnersRes.data)
      } catch (err: unknown) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchData()
    }
  }, [userId])

  // A partner az ellenkező nemű regisztráltak közül választható.
  const oppositeGender = gender === 'Fiú' ? 'Lány' : 'Fiú'

  // FOGLALT jelöltek: akinek van beállított partnere, vagy akire valaki más partnerként mutat.
  // Kivétel: a saját jelenlegi partnerem maradjon választható, hogy a legördülőben látszódjon.
  const takenIds = new Set<string>()
  availablePartners.forEach((p) => {
    if (p.partner_id) {
      takenIds.add(p.id)
      takenIds.add(p.partner_id)
    }
  })
  if (partnerId) takenIds.delete(partnerId)

  const filteredPartners = availablePartners.filter(
    (p) => p.gender === oppositeGender && !takenIds.has(p.id)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setErrorMsg(null)

    try {
      // 1) Sajat alap-mezok mentese (sajat sor -> RLS engedi)
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          gender,
          dance_level: danceLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) throw error

      // 2) Partner-kotes/bontas a szerveroldali route-on at (kolcsonos, RLS felett)
      const res = await fetch('/api/set-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, partnerId: partnerId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'A partner mentése nem sikerült.')

      setMessage('A profil sikeresen frissítve!')
      if (onSave) onSave()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Hiba történt a mentés során.'
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage('')

    // Kliensoldali jelszo-policy: min. 10 karakter, kis- es nagybetu, szam, spec. karakter
    const problems: string[] = []
    if (newPassword.length < 10) problems.push('legalább 10 karakter')
    if (!/[a-zíéáűőúöüó]/.test(newPassword)) problems.push('kisbetű')
    if (!/[A-ZÍÉÁŰŐÚÖÜÓ]/.test(newPassword)) problems.push('nagybetű')
    if (!/[0-9]/.test(newPassword)) problems.push('szám')
    if (!/[^A-Za-z0-9]/.test(newPassword)) problems.push('speciális karakter')

    if (problems.length > 0) {
      setPwMessage('A jelszónak tartalmaznia kell: ' + problems.join(', ') + '.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('A két jelszó nem egyezik.')
      return
    }

    setPwSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      setPwMessage('A jelszó sikeresen megváltozott!')
    } catch (err: any) {
      setPwMessage('Hiba a jelszó módosításakor: ' + err.message)
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-zinc-500">Profil betöltése...</div>
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-900 mb-4">Profil szerkesztése</h2>

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm text-center">
            {message}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
            Teljes név
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
            Nem
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setGender('Fiú')
                // ha a jelenlegi partner nem Lány, ürítjük
                const cur = availablePartners.find((p) => p.id === partnerId)
                if (cur && cur.gender !== 'Lány') setPartnerId('')
              }}
              className={`py-2 px-4 rounded-lg text-sm font-semibold border transition-colors ${
                gender === 'Fiú'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-600'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Fiú
            </button>
            <button
              type="button"
              onClick={() => {
                setGender('Lány')
                const cur = availablePartners.find((p) => p.id === partnerId)
                if (cur && cur.gender !== 'Fiú') setPartnerId('')
              }}
              className={`py-2 px-4 rounded-lg text-sm font-semibold border transition-colors ${
                gender === 'Lány'
                  ? 'bg-pink-50 border-pink-500 text-pink-600'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Lány
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
            Tánctudás szintje
          </label>
          <select
            value={danceLevel}
            onChange={(e) => setDanceLevel(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="" disabled>-- Válassz szintet --</option>
            <option value="Haladó">Haladó</option>
            <option value="SzuperH">SzuperH</option>
            <option value="ExtraH">ExtraH</option>
            <option value="Hobbi">Hobbi</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
            Partner neve
          </label>
          {filteredPartners.length === 0 ? (
            <p className="text-sm text-zinc-500 italic py-2">
              Nincs elérhető partner az ellenkező nemű regisztráltak között.
            </p>
          ) : (
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
            >
              <option value="">Nincs partner megadva</option>
              {filteredPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50 mt-2"
        >
          {saving ? 'Mentés...' : 'Mentés'}
        </button>
      </form>

      {/* Jelszó módosítása — külön blokk */}
      <form onSubmit={handlePasswordChange} className="space-y-4 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-900 mb-1">Jelszó módosítása</h2>

        {pwMessage && (
          <div
            className={`p-3 rounded-lg text-sm text-center ${
              pwMessage.includes('sikeresen')
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}
          >
            {pwMessage}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
            Új jelszó
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={10}
            required
            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
            Új jelszó megerősítése
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={10}
            required
            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={pwSaving}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
        >
          {pwSaving ? 'Mentés...' : 'Jelszó módosítása'}
        </button>
      </form>

      {/* Házirend — statikus olvasó + saját elfogadás dátuma */}
      <PolicyViewer userId={userId} />
    </div>
  )
}