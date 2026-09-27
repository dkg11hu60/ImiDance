'use client'

import { useState, useEffect } from 'react'
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
  const [gdprAccepted, setGdprAccepted] = useState(false)

  // CAPTCHA and anti-bot state
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaSvg, setCaptchaSvg] = useState<string | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [honeypot, setHoneypot] = useState('')

  async function fetchCaptcha() {
    setCaptchaLoading(true)
    try {
      const res = await fetch('/api/auth/captcha', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setCaptchaToken(data.token)
        setCaptchaSvg(data.svgDataUri)
        setCaptchaAnswer('')
      }
    } catch (err) {
      console.error('Failed to load CAPTCHA:', err)
    } finally {
      setCaptchaLoading(false)
    }
  }

  useEffect(() => {
    fetchCaptcha()
  }, [])

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

    if (!gdprAccepted) {
      setErrorMsg('A regisztrációhoz el kell fogadnod az Adatkezelési tájékoztatót / Privacy Policy!')
      return
    }

    if (!captchaAnswer.trim()) {
      setErrorMsg('Kérlek, add meg a képen látható ellenőrző kódot!')
      return
    }

    const sanitizedEmail = email.trim().toLowerCase()

    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // Saját SMTP-t használó API útvonal hívása CAPTCHA ellenőrzéssel
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sanitizedEmail,
          password,
          fullName: fullName.trim(),
          gender,
          danceLevel,
          captchaToken,
          captchaAnswer: captchaAnswer.trim(),
          honeypot,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Refresh CAPTCHA on error so bot or user can retry with fresh token
        fetchCaptcha()
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
          <p className="text-sm text-zinc-500">Csatlakozz az Imi Társastánc csoport alkalmazásához</p>
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

          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="gdpr-consent"
              type="checkbox"
              required
              checked={gdprAccepted}
              onChange={(e) => setGdprAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="gdpr-consent" className="text-xs text-zinc-600 select-none leading-relaxed cursor-pointer">
              Elolvastam és elfogadom az <a href="/adatkezelesi_tajekoztato.html" target="_blank" className="text-indigo-600 underline hover:text-indigo-800">Adatkezelési tájékoztatót</a> / I have read and accept the <a href="/privacy_policy.html" target="_blank" className="text-indigo-600 underline hover:text-indigo-800">Privacy Policy</a>. *
            </label>
          </div>

          {/* Biztonsági ellenőrzés (CAPTCHA a robotok és DDoS ellen) */}
          <div className="pt-2 border-t border-zinc-100 space-y-2">
            <label className="block text-xs font-semibold uppercase text-zinc-600">
              Biztonsági ellenőrzés (CAPTCHA) *
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-zinc-100 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-zinc-200 min-h-[54px]">
                {captchaSvg ? (
                  <img
                    src={captchaSvg}
                    alt="Biztonsági ellenőrző kód"
                    className="h-12 w-full object-contain select-none pointer-events-none"
                  />
                ) : (
                  <span className="text-xs text-zinc-400">Kód betöltése...</span>
                )}
              </div>
              <button
                type="button"
                onClick={fetchCaptcha}
                disabled={captchaLoading}
                className="p-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl border border-zinc-200 transition-colors cursor-pointer text-sm font-bold disabled:opacity-50"
                title="Új kód kérése"
              >
                🔄
              </button>
            </div>
            <input
              type="text"
              required
              autoCapitalize="characters"
              autoComplete="off"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
              placeholder="Írd be a képen látható 5 karaktert"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-sm text-zinc-900 font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Hidden honeypot to catch automated spam bots */}
          <div style={{ position: 'absolute', opacity: 0, zIndex: -1, height: 0, width: 0, overflow: 'hidden' }}>
            <input
              type="text"
              name="b_extra_verification"
              tabIndex={-1}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
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