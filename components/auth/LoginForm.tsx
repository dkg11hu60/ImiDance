'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function LoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [isResetMode, setIsResetMode] = useState(false)
  const [loading, setLoading] = useState(false)

  // Nézetváltáskor az üzenet automatikus törlése
  useEffect(() => {
    setMessage(null)
  }, [isResetMode])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage({ text: 'Hibás e-mail cím vagy jelszó.', error: true })
      setLoading(false)
      return
    }

    // Tiltás-ellenőrzés: kitiltott felhasználó nem léphet be
    const userId = signInData.user?.id
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .single()

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        setMessage({ text: 'A hozzáférésed le van tiltva. Fordulj az oktatóhoz.', error: true })
        setLoading(false)
        return
      }
    }

    onLoginSuccess()
    setLoading(false)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (!email.trim()) {
      setMessage({ text: 'Kérjük, add meg az e-mail címedet.', error: true })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setMessage({ text: 'A jelszó-visszaállító e-mail küldése sikertelen.', error: true })
    } else {
      setMessage({ text: 'A jelszó-visszaállító hivatkozást elküldtük az e-mail címedre.', error: false })
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md w-full bg-white/20 p-8 rounded-2xl shadow-sm border border-zinc-200 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Imi Társastánc csoportja</h1>
        <p className="text-sm text-zinc-500">{isResetMode ? 'Add meg az e-mail címed' : 'Jelentkezz be'}</p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs font-medium ${message.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {message.text}
        </div>
      )}

      {!isResetMode ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail cím"
            className="w-full px-4 py-2.5 border rounded-xl"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Jelszó"
            className="w-full px-4 py-2.5 border rounded-xl"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl disabled:opacity-50"
          >
            {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
          </button>
          <button
            type="button"
            onClick={() => setIsResetMode(true)}
            className="w-full text-xs text-indigo-600 hover:underline"
          >
            Elfelejtett jelszó?
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail cím"
            className="w-full px-4 py-2.5 border rounded-xl"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl disabled:opacity-50"
          >
            {loading ? 'Küldés...' : 'E-mail küldése'}
          </button>
          <button
            type="button"
            onClick={() => setIsResetMode(false)}
            className="w-full py-2 text-xs text-zinc-500 hover:underline"
          >
            Vissza a bejelentkezéshez
          </button>
        </form>
      )}
    </div>
  )
}