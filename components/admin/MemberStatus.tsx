'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type SortKey = 'full_name' | 'dance_level' | 'last_sign_in_at' | 'status'
type SortDir = 'asc' | 'desc'

export function MemberStatus() {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('last_sign_in_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null)
  const [dancerHistory, setDancerHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

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

  useEffect(() => {
    if (!selectedDancerId) {
      setDancerHistory([])
      return
    }

    async function loadDancerHistory() {
      setLoadingHistory(true)
      try {
        const { data, error } = await supabase
          .from('attendances')
          .select('id, event_name, status, attended, paid, created_at, events(id, event_date, start_time, title)')
          .eq('profile_id', selectedDancerId)

        if (error) throw error

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const mapped = (data || [])
          .map((a: any) => {
            const ev = Array.isArray(a.events) ? a.events[0] : a.events
            const rawDate = ev?.event_date || a.created_at || null

            const attended = Boolean(a.attended)
            const paid = Boolean(a.paid)

            let dateStr = 'Ismeretlen dátum'
            let isPast = false
            if (rawDate) {
              const d = new Date(rawDate)
              if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
                const dd = new Date(d)
                dd.setHours(0, 0, 0, 0)
                isPast = dd < today || (dd.getTime() === today.getTime() && (attended || paid))
              } else {
                dateStr = String(rawDate)
              }
            }

            return {
              id: a.id,
              date: dateStr,
              rawDate,
              title: ev?.title || a.event_name || 'Táncóra / Esemény',
              isPast,
              attended,
              paid,
              cancelled: (a.status ?? '') === 'cancelled',
            }
          })
          .sort((x: any, y: any) => new Date(y.rawDate || 0).getTime() - new Date(x.rawDate || 0).getTime())

        setDancerHistory(mapped)
      } catch (e: any) {
        console.error('Hiba az előzmények betöltésekor:', e.message)
      } finally {
        setLoadingHistory(false)
      }
    }

    loadDancerHistory()
  }, [selectedDancerId])

  async function toggleMemberActive(id: string, currentActive: boolean, userName: string) {
    if (currentActive) {
      const confirmMsg =
        `Biztosan le akarod tiltani a következőt: ${userName}?\n\n` +
        `A tiltás következményei:\n` +
        `• A felhasználó azonnal kizárásra kerül a rendszerből.\n` +
        `• Új bejelentkezésre nem lesz lehetősége.\n` +
        `• A korábbi adatai és jelenléti statisztikái megmaradnak.\n` +
        `• A művelet bármikor visszavonható (Aktiválás).`

      if (!confirm(confirmMsg)) return
    } else {
      const confirmMsg = `Biztosan újra aktiválod a következőt: ${userName}? Ezzel a felhasználó ismét be tud majd lépni.`
      if (!confirm(confirmMsg)) return
    }

    setUpdatingId(id)
    try {
      const res = await fetch('/api/set-user-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, active: !currentActive }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Hiba történt a státusz módosításakor.')

      setMembers(prev =>
        prev.map(m => (m.id === id ? { ...m, is_active: !currentActive } : m))
      )
    } catch (error: any) {
      alert('Hiba a tiltás/aktiválás során: ' + error.message)
    } finally {
      setUpdatingId(null)
    }
  }

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
            <th className="pb-3 text-center font-semibold text-zinc-500">Aktív (Beléphet)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((m, i) => (
            <tr key={m.id || i} className={!m.is_active ? 'bg-zinc-50/50' : ''}>
              <td className="py-3 font-medium text-zinc-900">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedDancerId(m.id)}
                    className="font-semibold text-zinc-900 text-left hover:text-indigo-600 hover:underline focus:outline-none"
                    title="Kattints a személyes statisztika megtekintéséhez"
                  >
                    {m.full_name}
                  </button>
                  {m.has_absence_warning && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 whitespace-nowrap inline-flex items-center gap-1 cursor-help"
                      title={`Lezajlott jelentkezései: ${m.held_event_count} | Hiányzott: ${m.missed_count} (${m.absence_rate}%)`}
                    >
                      ⚠️ Súlyos hiányzás ({m.absence_rate}%)
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 text-zinc-600">{m.dance_level || '—'}</td>
              <td className="py-3 text-zinc-600 tabular-nums">{formatDateTime(m.last_sign_in_at)}</td>
              <td className="py-3">
                {!m.is_active ? (
                  <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">letiltva</span>
                ) : m.last_sign_in_at ? (
                  <span className="text-xs font-semibold text-emerald-600">aktív</span>
                ) : (
                  <span className="text-xs font-semibold text-amber-600">még nem lépett be</span>
                )}
              </td>
              <td className="py-3 text-center">
                <input
                  type="checkbox"
                  checked={m.is_active !== false}
                  disabled={updatingId === m.id}
                  onChange={() => toggleMemberActive(m.id, m.is_active !== false, m.full_name)}
                  className="w-5 h-5 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Részletes statisztika modal */}
      {selectedDancerId && (() => {
        const selectedDancer = members.find(p => p.id === selectedDancerId)
        if (!selectedDancer) return null

        const activeHistory = dancerHistory.filter(r => !r.cancelled)
        const past = activeHistory.filter(r => r.isPast)
        const upcoming = activeHistory.filter(r => !r.isPast)

        const megjelent = past.filter(r => r.attended).length
        const fizetett = past.filter(r => r.paid).length

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200 flex flex-col max-h-[85vh]">
              <div className="bg-zinc-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-bold">Táncos részletes statisztikája</h3>
                  <p className="text-xs text-zinc-400">{selectedDancer.full_name} ({selectedDancer.dance_level || '—'})</p>
                </div>
                <button
                  onClick={() => setSelectedDancerId(null)}
                  className="text-zinc-400 hover:text-white transition-colors text-xl font-bold"
                  aria-label="Bezárás"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-6">
                {loadingHistory ? (
                  <div className="text-center py-12 text-zinc-500 animate-pulse font-medium">Statisztika betöltése...</div>
                ) : (
                  <>
                    {/* Összegzés (korábbi alkalmak) */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                        <div className="text-xs text-zinc-500 font-medium">Korábbi jelentkezés</div>
                        <div className="text-lg font-bold text-zinc-800">{past.length}</div>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div className="text-xs text-indigo-600 font-medium">Megjelent</div>
                        <div className="text-lg font-bold text-indigo-700">{megjelent}</div>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="text-xs text-emerald-600 font-medium">Fizetett</div>
                        <div className="text-lg font-bold text-emerald-700">{fizetett}</div>
                      </div>
                    </div>

                    {/* Korábbi alkalmak (múlt) */}
                    <div>
                      <h4 className="text-xs uppercase font-bold text-zinc-400 mb-2">Korábbi alkalmak</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase">
                              <th className="py-2.5 px-3">Dátum / Esemény</th>
                              <th className="py-2.5 px-3 text-center">Megjelent</th>
                              <th className="py-2.5 px-3 text-center">Fizetett</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {past.map((r) => (
                              <tr key={r.id} className="hover:bg-zinc-50">
                                <td className="py-2.5 px-3">
                                  <div className="font-medium text-zinc-900">{r.title}</div>
                                  <div className="text-xs text-zinc-500">{r.date}</div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {r.attended ? (
                                    <span className="text-indigo-600 font-bold">Igen</span>
                                  ) : (
                                    <span className="text-zinc-400">Nem</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {r.paid ? (
                                    <span className="text-emerald-600 font-bold">Igen</span>
                                  ) : (
                                    <span className="text-amber-600 font-bold">Nem</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {past.length === 0 && (
                              <tr>
                                <td colSpan={3} className="py-6 text-center text-zinc-400 italic">
                                  Nincs korábbi részvétele.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Közelgő jelentkezések */}
                    {upcoming.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase font-bold text-zinc-400 mb-2">Közelgő jelentkezések</h4>
                        <ul className="space-y-1">
                          {upcoming.map((r) => (
                            <li key={r.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-cyan-50/60 border border-cyan-100">
                              <span className="font-medium text-zinc-800">{r.title}</span>
                              <span className="text-xs text-zinc-500">{r.date}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="bg-zinc-50 px-6 py-4 flex justify-end gap-3 shrink-0 border-t border-zinc-100">
                <button
                  onClick={() => setSelectedDancerId(null)}
                  className="px-4 py-2 bg-zinc-950 text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors text-sm shadow-sm"
                >
                  Bezárás
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}