'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)          // van-e ervenyes recovery-session
  const [checking, setChecking] = useState(true)      // token-feldolgozas folyamatban
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function establishSession() {
      setChecking(true)

      // 1) Ha mar van session (pl. fragment-alapu flow mar lefutott), keszen vagyunk
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session) {
        setReady(true)
        setChecking(false)
        return
      }

      // 2) verify-flow: a link ?token_hash=...&type=recovery vagy ?token=...&type=recovery
      const url = new URL(window.location.href)
      const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token')
      const type = url.searchParams.get('type')

      if (tokenHash && type === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })
        if (!error) {
          setReady(true)
          setChecking(false)
          return
        }
      }

      // 3) PKCE-flow: ?code=...
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          setReady(true)
          setChecking(false)
          return
        }
      }

      // 4) Semmi nem sikerult -> nincs ervenyes session
      setReady(false)
      setChecking(false)
      setMessage({
        text: 'A hivatkozás érvénytelen vagy lejárt. Kérj új jelszó-beállító linket a bejelentkezési oldalon.',
        error: true,
      })
    }

    // Recovery-esemeny is beallithatja a sessiont (fragment-flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setChecking(false)
        setMessage(null)
      }
    })

    establishSession()
    return () => subscription.unsubscribe()
  }, [])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const problems: string[] = []
    if (password.length < 10) problems.push('legalább 10 karakter')
    if (!/[a-zíéáűőúöüó]/.test(password)) problems.push('kisbetű')
    if (!/[A-ZÍÉÁŰŐÚÖÜÓ]/.test(password)) problems.push('nagybetű')
    if (!/[0-9]/.test(password)) problems.push('szám')
    if (!/[^A-Za-z0-9]/.test(password)) problems.push('speciális karakter')

    if (problems.length > 0) {
      setMessage({ text: 'A jelszónak tartalmaznia kell: ' + problems.join(', ') + '.', error: true })
      return
    }
    if (password !== confirmPassword) {
      setMessage({ text: 'A két jelszó nem egyezik.', error: true })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage({ text: `Hiba: ${error.message}`, error: true })
    } else {
      setMessage({ text: 'A jelszavad sikeresen megváltozott! Átirányítás...', error: false })
      setTimeout(() => router.push('/'), 2000)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 space-y-6">
        <h1 className="text-2xl font-bold text-center text-zinc-900">Új jelszó megadása</h1>

        {message && (
          <div className={`p-3 rounded-xl text-xs font-medium ${message.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {message.text}
          </div>
        )}

        {checking ? (
          <p className="text-center text-sm text-zinc-500">Hivatkozás ellenőrzése...</p>
        ) : ready ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Új jelszó"
              className="w-full px-4 py-2.5 border rounded-xl text-zinc-900"
              autoComplete="new-password"
              minLength={10}
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Új jelszó megerősítése"
              className="w-full px-4 py-2.5 border rounded-xl text-zinc-900"
              autoComplete="new-password"
              minLength={10}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl disabled:opacity-50 font-medium"
            >
              {loading ? 'Mentés...' : 'Jelszó frissítése'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <a href="/" className="text-sm text-indigo-600 hover:underline font-medium">
              Vissza a bejelentkezéshez
            </a>
          </div>
        )}
      </div>
    </main>
  )
}