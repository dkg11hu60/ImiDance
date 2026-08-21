'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type Section = { key: string; heading: string; body: string }
type Policy = { version: number; title: string; sections: Section[] }

export function PolicyViewer({ userId }: { userId: string }) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null)
  const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: pol } = await supabase
        .from('policies')
        .select('version, title, sections')
        .eq('is_current', true)
        .single()
      setPolicy(pol as Policy | null)

      if (pol) {
        const { data: acc } = await supabase
          .from('policy_acceptances')
          .select('accepted_at, policy_version')
          .eq('profile_id', userId)
          .eq('policy_version', pol.version)
          .maybeSingle()
        if (acc) {
          setAcceptedAt(acc.accepted_at)
          setAcceptedVersion(acc.policy_version)
        }
      }
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) return <p className="text-sm text-zinc-500">Házirend betöltése…</p>
  if (!policy) return <p className="text-sm text-zinc-500">Nincs elérhető házirend.</p>

  return (
    <div className="max-w-2xl bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-bold text-zinc-900">{policy.title}</h1>
        <span className="text-xs text-zinc-400 shrink-0">v{policy.version}</span>
      </div>

      {acceptedAt ? (
        <div className="text-xs bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">
          Elfogadva: {new Date(acceptedAt).toLocaleString('hu-HU')} (v{acceptedVersion})
        </div>
      ) : (
        <div className="text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2">
          Ezt a verziót még nem fogadtad el.
        </div>
      )}

      <div className="space-y-4">
        {policy.sections.map(s => (
          <div key={s.key}>
            <h3 className="font-semibold text-zinc-900">{s.heading}</h3>
            <p className="text-sm text-zinc-700 whitespace-pre-line mt-0.5">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}