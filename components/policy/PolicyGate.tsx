'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Section = { key: string; heading: string; body: string }

type Policy = {
  id: number
  version: number
  title: string
  sections: Section[]
}

interface PolicyGateProps {
  userId: string
  onAccepted: () => void
}

export function PolicyGate({ userId, onAccepted }: PolicyGateProps) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [acceptedKeys, setAcceptedKeys] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPolicy() {
      setLoading(true)

      // 1. Aktuális házirend lekérése
      const { data: currentPolicy, error: polErr } = await supabase
        .from('policies')
        .select('id, version, title, sections')
        .eq('is_current', true)
        .maybeSingle()

      if (polErr || !currentPolicy) {
        // Ha nincs aktív házirend, átengedjük a felhasználót
        onAccepted()
        setLoading(false)
        return
      }

      // 2. Ellenőrzés: a felhasználó elfogadta-e már ezt a verziót?
      const { data: acceptance } = await supabase
        .from('policy_acceptances')
        .select('id')
        .eq('profile_id', userId)
        .eq('policy_version', currentPolicy.version)
        .maybeSingle()

      if (acceptance) {
        // Már elfogadta az aktuális verziót -> kapu nyitva
        onAccepted()
      } else {
        // Még nem fogadta el -> megjelenítjük a modált
        setPolicy(currentPolicy as Policy)
      }

      setLoading(false)
    }

    if (userId) {
      loadPolicy()
    }
  }, [userId, onAccepted])

  if (loading || !policy) return null

  const sections = policy.sections || []
  const totalCount = sections.length
  const acceptedCount = Object.values(acceptedKeys).filter(Boolean).length
  const allAccepted = totalCount > 0 && acceptedCount === totalCount

  function toggleSection(key: string) {
    setAcceptedKeys(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleAcceptAll() {
    if (!policy || !allAccepted || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const { error: insertErr } = await supabase.from('policy_acceptances').insert({
        profile_id: userId,
        policy_id: policy.id,
        policy_version: policy.version,
      })

      if (insertErr) throw insertErr
      onAccepted()
    } catch (e: any) {
      setError(e?.message || 'Hiba történt az elfogadás során.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden border border-zinc-200">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 bg-zinc-50">
          <div
            className="text-lg font-bold text-zinc-900 [&_h1]:text-lg [&_h1]:font-bold [&_b]:font-bold [&_strong]:font-bold"
            dangerouslySetInnerHTML={{ __html: policy.title }}
          />
          <p className="text-xs text-zinc-500 mt-1">
            Minden pontot végig kell olvasnod és külön elfogadnod ({acceptedCount}/{totalCount}).
          </p>
        </div>

        {/* Body - Section list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sections.map((s, idx) => {
            const key = s.key || `sec-${idx}`
            const isChecked = !!acceptedKeys[key]

            return (
              <div
                key={key}
                className={`border rounded-xl overflow-hidden transition-colors ${
                  isChecked ? 'border-indigo-200 bg-indigo-50/20' : 'border-zinc-200 bg-white'
                }`}
              >
                <div
                  className="px-4 py-2 bg-zinc-50 font-bold text-sm text-zinc-900 border-b border-zinc-100 [&_b]:font-bold [&_strong]:font-bold"
                  dangerouslySetInnerHTML={{ __html: s.heading || `Szakasz ${idx + 1}` }}
                />

                <div
                  className="px-4 py-3 text-sm text-zinc-700 leading-snug whitespace-pre-line [&_p]:mb-1 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_a]:text-indigo-600 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: s.body }}
                />

                <div className="px-4 py-2.5 bg-zinc-50/50 border-t border-zinc-100 flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id={`check-${key}`}
                    checked={isChecked}
                    onChange={() => toggleSection(key)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 cursor-pointer"
                  />
                  <label htmlFor={`check-${key}`} className="text-xs font-medium text-zinc-700 cursor-pointer select-none">
                    Megértettem és elfogadom
                  </label>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {error && (
          <div className="px-5 py-2 bg-red-50 text-red-700 text-xs border-t border-red-200">
            {error}
          </div>
        )}

        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
          <button
            onClick={handleAcceptAll}
            disabled={!allAccepted || submitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Mentés…' : 'Megértettem és elfogadom'}
          </button>
        </div>

      </div>
    </div>
  )
}