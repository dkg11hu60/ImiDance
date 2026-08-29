'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MyAttendanceProps {
  userId?: string
}

interface Row {
  id: string
  date: string
  rawDate: string | null
  title: string
  isPast: boolean
  attended: boolean
  paid: boolean
  cancelled: boolean
}

export function MyAttendance({ userId }: MyAttendanceProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let aborted = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        // Szigorúan a saját sorok — RLS-re támaszkodva, nem RPC-vel.
        const { data, error: err } = await supabase
          .from('attendances')
          .select('id, event_name, status, attended, paid, created_at, events(event_date, start_time, title)')
          .eq('profile_id', userId)

        if (err) throw err

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const mapped: Row[] = (data || [])
          .map((a: any) => {
            const ev = Array.isArray(a.events) ? a.events[0] : a.events
            const rawDate = ev?.event_date || a.created_at || null

            let dateStr = 'Ismeretlen dátum'
            let isPast = false
            if (rawDate) {
              const d = new Date(rawDate)
              if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
                const dd = new Date(d)
                dd.setHours(0, 0, 0, 0)
                isPast = dd < today
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
              attended: Boolean(a.attended),
              paid: Boolean(a.paid),
              cancelled: (a.status ?? '') === 'cancelled',
            }
          })
          .sort((x: Row, y: Row) => new Date(y.rawDate || 0).getTime() - new Date(x.rawDate || 0).getTime())

        if (!aborted) setRows(mapped)
      } catch (e: any) {
        if (!aborted) setError(e.message || 'Ismeretlen hiba történt.')
      } finally {
        if (!aborted) setLoading(false)
      }
    }

    load()
    return () => {
      aborted = true
    }
  }, [userId])

  // Csak az élő (nem lemondott) jelentkezések számítanak részvételnek.
  const active = rows.filter((r) => !r.cancelled)
  const past = active.filter((r) => r.isPast)
  const upcoming = active.filter((r) => !r.isPast)

  const megjelent = past.filter((r) => r.attended).length
  const fizetett = past.filter((r) => r.paid).length

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="py-8 text-center text-zinc-500 font-medium animate-pulse">Betöltés...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm">
        <div className="py-6 text-center text-rose-600 text-sm">Hiba: {error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
      <div>
        <h3 className="text-lg font-bold text-zinc-900">Saját részvételem</h3>
        <p className="text-xs text-zinc-500">Kizárólag a te adataid — jelentkezés, megjelenés és fizetés alkalmanként.</p>
      </div>

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
                    Még nincs korábbi részvételed.
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
          <h4 className="text-xs uppercase font-bold text-zinc-400 mb-2">Közelgő jelentkezéseim</h4>
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
    </div>
  )
}