'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState<'Fiú' | 'Lány'>('Fiú')
  const [danceLevel, setDanceLevel] = useState<'' | 'Haladó' | 'SzuperH' | 'ExtraH' | 'Hobbi'>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!danceLevel) {
      setErrorMsg('Kérlek, válaszd ki a tánctudásod szintjét!')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('A két jelszó nem egyezik meg!')
      return
    }

    // Minimum 10 characters, at least one lowercase, one uppercase, one number, and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/
    if (!passwordRegex.test(password)) {
      setErrorMsg('A jelszónak legalább 10 karakter hosszúnak kell lennie, és tartalmaznia kell kisbetűt, nagybetűt, számot, valamint speciális karaktert!')
      return
    }

    const sanitizedEmail = email.trim().toLowerCase()

    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // Saját SMTP-t használó API útvonal hívása a közvetlen Supabase Auth helyett
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sanitizedEmail,
          password,
          fullName: fullName.trim(),
          gender,
          danceLevel,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'A regisztráció nem sikerült.')
      }

      setSuccessMsg(data.message || 'Sikeres regisztráció! Kérlek, ellenőrizd az e-mail fiókodat a megerősítő linkért.')

      // Delayed redirect
      setTimeout(() => {
        router.push('/')
      }, 4000)
    } catch (err: unknown) {
      console.error('Registration error:', err)
      const message = err instanceof Error ? err.message : 'Hiba történt a regisztráció során.'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="w-full max-w-md backdrop-blur-sm rounded-2xl border border-zinc-200 shadow-sm p-8 space-y-6 bg-white/80">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">Regisztráció</h1>
          <p className="text-sm text-zinc-500">Csatlakozz az Imis Társastánc csoport alkalmazásához</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm text-center font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
              Teljes név
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Kovács János"
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
                onClick={() => setGender('Fiú')}
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
                onClick={() => setGender('Lány')}
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
              required
              value={danceLevel}
              onChange={(e) => setDanceLevel(e.target.value as any)}
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
              E-mail cím
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="janos@example.com"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
              Jelszó
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">
              Jelszó megerősítése
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Regisztráció...' : 'Regisztrálok'}
          </button>
        </form>
      </div>
    </div>
  )
}