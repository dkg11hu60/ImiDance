'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PrivacyGateProps {
  userId: string
  onAccepted: () => void
}

export function PrivacyGate({ userId, onAccepted }: PrivacyGateProps) {
  const [loading, setLoading] = useState(true)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const CURRENT_PRIVACY_VERSION = 1

  useEffect(() => {
    async function checkPrivacyStatus() {
      setLoading(true)
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('privacy_accepted_version')
          .eq('id', userId)
          .maybeSingle()

        if (error) throw error

        if (profile && profile.privacy_accepted_version >= CURRENT_PRIVACY_VERSION) {
          onAccepted()
        }
      } catch (e: any) {
        console.error('Error checking privacy policy status:', e)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      checkPrivacyStatus()
    }
  }, [userId, onAccepted])

  if (loading) return null

  async function handleAccept() {
    if (!accepted || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/accept-privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          version: CURRENT_PRIVACY_VERSION,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Nem sikerült rögzíteni az elfogadást.')
      }

      onAccepted()
    } catch (e: any) {
      setError(e?.message || 'Hiba történt a jóváhagyás során.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 bg-zinc-50">
          <h2 className="text-lg font-bold text-zinc-900">
            Adatkezelési tájékoztató elfogadása / Privacy Policy
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Az adatvédelmi szabályzatunk megváltozott vagy még nincs elfogadva.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-zinc-600 leading-relaxed">
            Kedves Táncosunk! A GDPR jogszabályoknak való tökéletes megfelelés és a személyes adataid védelme érdekében kérjük, olvasd el és fogadd el a frissített Adatkezelési Tájékoztatónkat a szolgáltatás további használatához.
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Az adatkezelés célja kizárólag a táncórák szervezése, az adminisztráció, az órarendek kezelése és a kötelező számviteli számlázás.
          </p>

          <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-800">Elérhető dokumentumok / Available documents:</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <a 
                href="/adatkezelesi_tajekoztato.html" 
                target="_blank" 
                className="flex-1 text-center py-2.5 px-4 bg-white border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
              >
                🇭🇺 Adatkezelési Tájékoztató
              </a>
              <a 
                href="/privacy_policy.html" 
                target="_blank" 
                className="flex-1 text-center py-2.5 px-4 bg-white border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
              >
                🇬🇧 Privacy Policy (English)
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <input
              type="checkbox"
              id="privacy-chk"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 cursor-pointer"
            />
            <label htmlFor="privacy-chk" className="text-xs text-zinc-600 cursor-pointer leading-relaxed select-none">
              Elolvastam, megértettem és önkéntesen hozzájárulok a személyes adataim kezeléséhez a fenti tájékoztatókban leírtak alapján. / I have read, understood, and voluntarily consent to the processing of my personal data as described in the policies above.
            </label>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-5 py-2.5 bg-red-50 text-red-700 text-xs border-t border-red-200 font-medium">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
          <button
            onClick={handleAccept}
            disabled={!accepted || submitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Rögzítés…' : 'Elfogadom / I Accept'}
          </button>
        </div>

      </div>
    </div>
  )
}