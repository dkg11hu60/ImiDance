'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface EventItem {
  id: string
  title?: string
  event_date: string
  start_time?: string
  is_active?: boolean
}

interface DancerRow {
  attendanceId?: string
  profileId: string
  name: string
  danceLevel: string
  isRegistered: boolean
  attended: boolean
  paid: boolean
}

type SortOrder = 'asc' | 'desc'

export function EventAttendanceManager() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [attendances, setAttendances] = useState<any[]>([])
  const [onlyRegistered, setOnlyRegistered] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    async function initData() {
      try {
        setLoadingEvents(true)
        const [eventsRes, profilesRes] = await Promise.all([
          supabase.from('events').select('*').order('event_date', { ascending: true }),
          supabase.from('profiles').select('*')
        ])

        if (eventsRes.error) throw eventsRes.error
        if (profilesRes.error) throw profilesRes.error

        if (profilesRes.data) setAllProfiles(profilesRes.data)

        if (eventsRes.data && eventsRes.data.length > 0) {
          const todayStr = new Date().toISOString().split('T')[0]

          const activeUpcomingEvents = eventsRes.data.filter((ev: any) => {
            if (ev.is_active === false) return false
            const dateStr = (ev.event_date || ev.day || ev.created_at || '').split('T')[0]
            return dateStr >= todayStr
          })

          setEvents(activeUpcomingEvents)

          if (activeUpcomingEvents.length > 0) {
            const now = Date.now()
            let closestId = activeUpcomingEvents[0].id
            let minDiff = Infinity

            activeUpcomingEvents.forEach((ev: any) => {
              const dateStr = (ev.event_date || ev.day || ev.created_at || '').split('T')[0]
              const timeStr = (ev.start_time || '00:00').slice(0, 5)
              const evTimestamp = new Date(`${dateStr}T${timeStr}:00`).getTime()

              const diff = Math.abs(evTimestamp - now)
              if (diff < minDiff) {
                minDiff = diff
                closestId = ev.id
              }
            })
            setSelectedEventId(closestId)
          }
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('Hiba az adatok betöltésekor:', err?.message || err?.details || JSON.stringify(err))
      } finally {
        setLoadingEvents(false)
      }
    }

    initData()
  }, [])

  useEffect(() => {
    if (!selectedEventId) return

    async function loadAttendances() {
      try {
        setLoadingData(true)
        const { data, error } = await supabase
          .from('attendances')
          .select('*')
          .eq('event_id', selectedEventId)

        if (error) throw error
        setAttendances(data || [])
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('Hiba a jelenlétek betöltésekor:', err?.message || err?.details || JSON.stringify(err))
      } finally {
        setLoadingData(false)
      }
    }

    loadAttendances()
  }, [selectedEventId])

  const attMap = new Map(attendances.map(a => [a.profile_id || a.user_id, a]))

  const isDancerRegistered = (att: any) => {
    if (!att) return false
    return att.status === 'registered'
  }

  const registeredCount = allProfiles.filter(p => isDancerRegistered(attMap.get(p.id))).length

  const dancerRows: DancerRow[] = allProfiles
    .map(p => {
      const att = attMap.get(p.id)
      const name = p.full_name || (p.first_name && p.last_name ? `${p.last_name} ${p.first_name}` : p.name) || 'Névtelen'
      const danceLevel = p.dance_level || p.skill_level || '-'

      return {
        attendanceId: att?.id,
        profileId: p.id,
        name,
        danceLevel,
        isRegistered: isDancerRegistered(att),
        attended: Boolean(att?.attended),
        paid: Boolean(att?.paid)
      }
    })
    .filter(row => (onlyRegistered ? row.isRegistered : true))
    .filter(row => row.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'hu')
      return sortOrder === 'asc' ? cmp : -cmp
    })

  const handleToggle = async (row: DancerRow, field: 'attended' | 'paid') => {
    const newValue = !row[field]
    setUpdatingId(`${row.profileId}-${field}`)

    try {
      if (row.attendanceId) {
        const { error } = await supabase
          .from('attendances')
          .update({ [field]: newValue })
          .eq('id', row.attendanceId)

        if (error) throw error

        setAttendances(prev =>
          prev.map(a => (a.id === row.attendanceId ? { ...a, [field]: newValue } : a))
        )
      } else {
        const newRecord: any = {
          profile_id: row.profileId,
          event_id: selectedEventId,
          registered: false,
          attended: field === 'attended' ? newValue : false,
          paid: field === 'paid' ? newValue : false
        }

        const { data, error } = await supabase
          .from('attendances')
          .insert(newRecord)
          .select()
          .single()

        if (error) throw error
        if (data) {
          setAttendances(prev => [...prev, data])
        }
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Módosítási hiba:', err?.message || err?.details || JSON.stringify(err))
    } finally {
      setUpdatingId(null)
    }
  }

  const handleBulkSet = async (field: 'attended' | 'paid', targetValue: boolean) => {
    try {
      const { error } = await supabase
        .from('attendances')
        .update({ [field]: targetValue })
        .eq('event_id', selectedEventId)

      if (error) throw error
      setAttendances(prev => prev.map(a => ({ ...a, [field]: targetValue })))
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Tömeges frissítési hiba:', err?.message || err?.details || JSON.stringify(err))
    }
  }

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
  }

  const formatEventDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return !isNaN(d.getTime())
      ? d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      : dateStr
  }

  if (loadingEvents) {
    return <div className="p-6 text-zinc-500">Események betöltése...</div>
  }

  if (events.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm text-center max-w-4xl mx-auto space-y-2">
        <h3 className="text-lg font-bold text-zinc-800">Nincs aktív vagy közeledő alkalom</h3>
        <p className="text-sm text-zinc-500">A múltbéli és inaktív események nem jelennek meg a beléptető felületen.</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Jelenlét & Fizetés Rögzítése</h3>
          <p className="text-xs text-zinc-500">Válaszd ki az alkalmat a jelenléti ív kezeléséhez</p>
        </div>

        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="px-4 py-2 text-sm font-semibold rounded-xl border border-zinc-300 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {formatEventDate(ev.event_date)} — {ev.title || 'Táncóra'}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 bg-zinc-200/70 rounded-xl">
            <button
              onClick={() => setOnlyRegistered(true)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                onlyRegistered ? 'bg-white text-indigo-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Csak regisztráltak ({registeredCount})
            </button>
            <button
              onClick={() => setOnlyRegistered(false)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                !onlyRegistered ? 'bg-white text-indigo-700 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Minden táncos ({allProfiles.length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Keresés névre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1 text-xs border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkSet('attended', true)}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Mind megjelent
          </button>
          <button
            onClick={() => handleBulkSet('paid', true)}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Mind fizetett
          </button>
        </div>
      </div>

      {loadingData ? (
        <div className="py-8 text-center text-zinc-500 italic">Adatok betöltése...</div>
      ) : dancerRows.length === 0 ? (
        <div className="py-8 text-center text-zinc-400 italic">Nincs megjeleníthető táncos.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase select-none">
                <th
                  onClick={toggleSortOrder}
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 transition-colors"
                >
                  Név {sortOrder === 'asc' ? '▲ (A–Z)' : '▼ (Z–A)'}
                </th>
                <th className="py-3 px-3">Szint</th>
                <th className="py-3 px-3 text-center">Előzetesen regisztrált</th>
                <th className="py-3 px-3 text-center">Részt vett</th>
                <th className="py-3 px-3 text-center">Fizetés</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {dancerRows.map((row) => (
                <tr key={row.profileId} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 px-3 font-semibold text-zinc-900">{row.name}</td>
                  <td className="py-3 px-3 text-xs text-zinc-500">{row.danceLevel}</td>
                  <td className="py-3 px-3 text-center text-xs">
                    {row.isRegistered ? (
                      <span className="inline-flex px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Igen</span>
                    ) : (
                      <span className="text-zinc-400">Nem</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleToggle(row, 'attended')}
                      disabled={updatingId === `${row.profileId}-attended`}
                      className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        row.attended
                          ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                          : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                      }`}
                    >
                      {row.attended ? 'Igen' : 'Nem'}
                    </button>
                  </td>

                  <td className="py-3 px-3 text-center">
                    {row.attended ? (
                      <button
                        onClick={() => handleToggle(row, 'paid')}
                        disabled={updatingId === `${row.profileId}-paid`}
                        className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                          row.paid
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-rose-600 text-white hover:bg-rose-700'
                        }`}
                      >
                        {row.paid ? 'Fizetve' : 'Nincs'}
                      </button>
                    ) : (
                      <span className="text-zinc-300 font-bold text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}