'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadVisibleObjects } from '@/lib/permissions'

export function EventList({ userId, onNavigateProfile }: { userId: string; onNavigateProfile?: () => void }) {
  const [events, setEvents] = useState<any[]>([])
  const [profilesMap, setProfilesMap] = useState<{ [key: string]: any }>({})
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)
  const [attendances, setAttendances] = useState<{ [key: string]: boolean }>({})
  const [canAttend, setCanAttend] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function toDateKey(value: any): string {
    if (!value) return ''
    const str = value.toString().split('T')[0].split(' ')[0]
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
    const d = new Date(value)
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    return str
  }

  function eventStart(ev: any): Date {
    const dateKey = toDateKey(ev.event_date)
    const time = (ev.start_time || '00:00').toString().slice(0, 5)
    const dt = new Date(`${dateKey}T${time}:00`)
    return isNaN(dt.getTime()) ? new Date(ev.event_date) : dt
  }

  function formatEventDate(dateValue: any): string {
    const dateKey = toDateKey(dateValue)
    if (!dateKey) return 'Ismeretlen dátum'
    const parts = dateKey.split('-')
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
    }
    return dateValue
  }

  useEffect(() => {
    loadData()
  }, [userId])

  async function loadData() {
    setLoading(true)

    const [evsRes, profsRes, attsRes] = await Promise.all([
      supabase.from('events').select('*, locations(*)').order('event_date', { ascending: true }),
      supabase.from('profiles').select('*'),
      supabase.from('attendances').select('*')
    ])

    const now = new Date()
    const upcoming = (evsRes.data || []).filter(
      (ev: any) => ev.is_active !== false && eventStart(ev).getTime() >= now.getTime()
    )
    setEvents(upcoming)

    let myProfile: any = null
    if (profsRes.data) {
      const map: { [key: string]: any } = {}
      profsRes.data.forEach((p: any) => { map[p.id] = p })
      setProfilesMap(map)
      myProfile = map[userId]
      setCurrentUserProfile(myProfile)
    }

    setCanAttend((await loadVisibleObjects(userId)).has('event.attend'))

    if (attsRes.data) {
      const attMap: { [key: string]: boolean } = {}
      attsRes.data.forEach((a: any) => {
        const pId = a.profile_id || a.user_id
        const eId = a.event_id || a.event
        if (pId && eId) {
          attMap[`${pId}_${eId}`] = true
        }
      })
      setAttendances(attMap)
    }

    setLoading(false)
  }

  async function toggleAttendance(ev: any, willAttend: boolean) {
    if (!userId || !canAttend) return
    if (ev.is_active === false) return
    setBusy(ev.id)
    setErr(null)

    try {
      const res = await fetch('/api/set-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, eventId: ev.id, attend: willAttend }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'A művelet nem sikerült.')

      const partnerId = currentUserProfile?.partner_id || null
      setAttendances(prev => {
        const next = { ...prev }
        const keys = [`${userId}_${ev.id}`]
        if (partnerId) keys.push(`${partnerId}_${ev.id}`)
        keys.forEach(k => {
          if (willAttend) next[k] = true
          else delete next[k]
        })
        return next
      })
    } catch (e: any) {
      setErr(e?.message || 'A művelet nem sikerült.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="text-center py-6 text-zinc-500">Alkalmak betöltése...</div>

  const partner = currentUserProfile?.partner_id ? profilesMap[currentUserProfile.partner_id] : null

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-[11px] text-indigo-600 font-semibold uppercase tracking-wider">Állandó partner státusz</p>
          <div className="text-sm font-bold text-indigo-900 mt-0.5">
            {partner ? (
              <span>Partnered: {partner.full_name || partner.name}</span>
            ) : (
              <button
                type="button"
                onClick={onNavigateProfile}
                title="Ide kattintva beállíthatod"
                className="text-left font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors focus:outline-none"
              >
                Partnered: -
              </button>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold text-zinc-900 pt-1">Közelgő táncalkalmak</h2>

      {events.length === 0 && (
        <p className="text-sm text-zinc-500 italic">Nincs közelgő táncalkalom.</p>
      )}

      {events.map(ev => {
        const isUserAttending = !!attendances[`${userId}_${ev.id}`]
        const isPartnerAttending = partner ? !!attendances[`${partner.id}_${ev.id}`] : false
        const loc = ev.locations

        return (
          <div
            key={ev.id}
            className="border rounded-2xl bg-white/20 backdrop-blur-sm shadow-sm overflow-hidden border-zinc-200"
          >
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-zinc-900 capitalize text-sm sm:text-base leading-snug">
                  {formatEventDate(ev.event_date)}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-emerald-600 mt-0.5">
                  {ev.start_time && ev.end_time ? `${ev.start_time.slice(0, 5)} - ${ev.end_time.slice(0, 5)}` : 'Időpont nincs megadva'}
                </div>

                {ev.title && <div className="text-xs text-zinc-500 mt-0.5 truncate">{ev.title}</div>}

                {loc ? (
                  <div className="text-xs text-zinc-700 mt-0.5 flex items-center gap-1 font-medium">
                    <span>📍</span>
                    {loc.maps_url ? (
                      <a href={loc.maps_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-600 font-semibold truncate">{loc.name}</a>
                    ) : (
                      <span className="font-semibold truncate">{loc.name}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1"><span>📍</span> Helyszín nincs megadva</div>
                )}

                {partner && (
                  <div className="text-xs mt-1 font-medium">
                    {isPartnerAttending
                      ? <span className="text-emerald-600">Partnered ({partner.full_name || partner.name}) is jön</span>
                      : <span className="text-zinc-400">Partnered még nem jelezte</span>}
                  </div>
                )}
              </div>

              {canAttend ? (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() => toggleAttendance(ev, !isUserAttending)}
                    disabled={busy === ev.id}
                    title={`Az eseményekre való jelentkezést / lemondást a gombra kattintással teheted meg az esemény kezdetéig.\nÍgy nem szükséges a tanárt külön értesítened.`}
                    className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50 transition-colors ${
                      isUserAttending ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {busy === ev.id ? '...' : isUserAttending ? 'Lemondom' : 'Ott leszek'}
                  </button>
                  {err && busy === null && (
                    <span className="text-[11px] text-red-500">{err}</span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-zinc-400 italic whitespace-nowrap shrink-0">Állandó résztvevő</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}