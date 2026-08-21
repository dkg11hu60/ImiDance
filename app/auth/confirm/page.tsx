'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function ConfirmContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function verifyToken() {
      if (!tokenHash || !type) {
        setStatus('error')
        setErrorMessage('Érvénytelen vagy hiányzó megerősítő hivatkozás.')
        return
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as any,
        })

        if (error) {
          throw error
        }

        setStatus('success')
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err?.message || 'A hivatkozás érvénytelen vagy lejárt.')
      }
    }

    verifyToken()
  }, [tokenHash, type, router])

  return (
    <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm text-center space-y-4">
      {status === 'loading' && (
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-900">Megerősítés folyamatban...</h2>
          <p className="text-sm text-zinc-500">Kérjük, várj egy pillanatot, amíg azonosítjuk a fiókodat.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-emerald-600">Sikeres megerősítés!</h2>
          <p className="text-sm text-zinc-600">A fiókod sikeresen aktiválva lett. Pillanatokon belül átirányítunk a kezdőlapra...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-red-600">Sikertelen megerősítés</h2>
          <p className="text-sm text-zinc-600">{errorMessage}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Vissza a kezdőlapra
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-zinc-600 font-medium">Betöltés...</div>}>
        <ConfirmContent />
      </Suspense>
    </div>
  )
}