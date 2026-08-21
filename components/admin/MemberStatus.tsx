'use client'

import { useState, useEffect } from 'react'

type SortKey = 'full_name' | 'dance_level' | 'last_sign_in_at' | 'status'
type SortDir = 'asc' | 'desc'

export function MemberStatus() {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('last_sign_in_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/member-status', { method: 'POST' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Betöltési hiba.')
        setMembers(json.members || [])
      } catch (e: any) {
        setErr(e?.message || 'Betöltési hiba.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function formatDateTime(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('hu-HU', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Alapértelmezett irány oszloponként: névnél/szintnél A→Z, dátumnál a legutóbbi elöl
      setSortDir(key === 'full_name' || key === 'dance_level' ? 'asc' : 'desc')
    }
  }

  function sortValue(m: any, key: SortKey): string | number {
    switch (key) {
      case 'full_name':   return (m.full_name || '').toLowerCase()
      case 'dance_level': return (m.dance_level || '').toLowerCase()
      case 'last_sign_in_at': {
        const t = m.last_sign_in_at ? new Date(m.last_sign_in_at).getTime() : NaN
        return isNaN(t) ? -Infinity : t          // "még nem lépett be" a lista végére
      }
      case 'status':      return m.last_sign_in_at ? 1 : 0
    }
  }

  const sorted = [...members].sort((a, b) => {
    const va = sortValue(a, sortKey)
    const vb = sortValue(b, sortKey)
    let cmp = 0
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
    else cmp = String(va).localeCompare(String(vb), 'hu')
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (loading) return <div className="text-center py-6 text-zinc-500">Betöltés...</div>
  if (err) return <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{err}</div>

  const belepett = members.filter(m => m.last_sign_in_at).length

  const arrow = (key: SortKey) =>
    key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  const th = (key: SortKey, label: string, extra = '') => (
    <th
      className={`pb-3 cursor-pointer select-none hover:text-indigo-600 ${extra}`}
      onClick={() => toggleSort(key)}
    >
      {label}<span className="text-indigo-500">{arrow(key)}</span>
    </th>
  )

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 overflow-x-auto">
      <h2 className="text-xl font-bold mb-1">Tagok aktivitása</h2>
      <p className="text-sm text-zinc-500 mb-6">
        {belepett} / {members.length} tag lépett be eddig.
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            {th('full_name', 'Név')}
            {th('dance_level', 'Szint')}
            {th('last_sign_in_at', 'Utolsó belépés')}
            {th('status', 'Állapot')}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((m, i) => (
            <tr key={i}>
              <td className="py-3 font-medium text-zinc-900">{m.full_name}</td>
              <td className="py-3 text-zinc-600">{m.dance_level || '—'}</td>
              <td className="py-3 text-zinc-600 tabular-nums">{formatDateTime(m.last_sign_in_at)}</td>
              <td className="py-3">
                {m.last_sign_in_at
                  ? <span className="text-xs font-semibold text-emerald-600">aktív</span>
                  : <span className="text-xs font-semibold text-amber-600">még nem lépett be</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}