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
  pastRegistered?: number
  pastAttended?: number
  pastPaid?: number
}

type SortOrder = 'asc' | 'desc'

export function EventAttendanceManager() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [attendances, setAttendances] = useState<any[]>([])
  const [allAttendances, setAllAttendances] = useState<any[]>([])
  const [pastEventIds, setPastEventIds] = useState<Set<string>>(new Set())
  const [allEventsMap, setAllEventsMap] = useState<Map<string, any>>(new Map())
  const [dancerStatsMap, setDancerStatsMap] = useState<Map<string, { registered: number; attended: number; paid: number }>>(new Map())
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null)
  const [credibilityMap, setCredibilityMap] = useState<Map<string, number>>(new Map())
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
        const [eventsRes, profilesRes, attendancesRes, rolesRes] = await Promise.all([
          supabase.from('events').select('*').order('event_date', { ascending: true }),
          supabase.from('profiles').select('*'),
          supabase.from('attendances').select('*'),
          supabase.from('user_roles').select('user_id, role_key')
        ])

        if (eventsRes.error) throw eventsRes.error
        if (profilesRes.error) throw profilesRes.error
        if (attendancesRes.error) throw attendancesRes.error

        const userRolesMap: { [userId: string]: string[] } = {}
        if (rolesRes.data) {
          rolesRes.data.forEach((ur: any) => {
            if (!userRolesMap[ur.user_id]) userRolesMap[ur.user_id] = []
            userRolesMap[ur.user_id].push(ur.role_key)
          })
        }

        const isTestProfile = (prof: any) => {
          const fieldsToSearch = [prof.full_name, prof.first_name, prof.last_name, prof.email, prof.name]
          return fieldsToSearch.some((f) => f && String(f).toLowerCase().includes('teszt'))
        }

        // Kiszűrjük a tiszta tanárokat/beléptetőket és a teszt felhasználókat
        const filteredProfiles = (profilesRes.data || []).filter((prof: any) => {
          if (isTestProfile(prof)) return false

          let roles = userRolesMap[prof.id] || []
          if (roles.length === 0 && prof.role) {
            roles = [prof.role]
          }
          if (roles.length === 0) {
            roles = ['user']
          }
          return roles.includes('user') || roles.includes('admin')
        })

        setAllProfiles(filteredProfiles)

        // Számoljuk ki a megbízhatósági indexeket és a múltbeli statisztikákat
        const rawAtts = attendancesRes.data || []
        const eventsData = eventsRes.data || []
        const profilesData = filteredProfiles
        setAllAttendances(rawAtts)

        const now = new Date()

        // Múltbeli események ID halmaza
        const computedPastEventIds = new Set<string>(
          eventsData
            .filter((ev: any) => {
              const datePart = ev.event_date ? ev.event_date.split('T')[0] : ""
              const timePart = ev.end_time || ev.start_time || "23:59:59"
              const eventEnd = new Date(`${datePart}T${timePart}`)

              if (isNaN(eventEnd.getTime())) return false
              return eventEnd <= now
            })
            .map((ev: any) => ev.id)
        )
        setPastEventIds(computedPastEventIds)

        const evMap = new Map(eventsData.map(e => [e.id, e]))
        setAllEventsMap(evMap)

        // Múltbeli részvételi és fizetési statisztikák
        const userPastCounts = new Map<string, { registered: number; attended: number; paid: number }>()
        rawAtts.forEach((att: any) => {
          const isPast = computedPastEventIds.has(att.event_id)
          const isActive = (att.status ?? '') !== 'cancelled'
          if (isPast && isActive) {
            const pid = att.profile_id || att.user_id
            if (pid) {
              if (!userPastCounts.has(pid)) {
                userPastCounts.set(pid, { registered: 0, attended: 0, paid: 0 })
              }
              const item = userPastCounts.get(pid)!
              item.registered += 1
              if (att.attended === true) {
                item.attended += 1
              }
              if (att.paid === true) {
                item.paid += 1
              }
            }
          }
        })
        setDancerStatsMap(userPastCounts)

        const credMap = new Map<string, number>()
        profilesData.forEach((p: any) => {
          const counts = userPastCounts.get(p.id)
          const rating = counts && counts.registered > 0 ? counts.attended / counts.registered : 1.0
          credMap.set(p.id, rating)
        })
        setCredibilityMap(credMap)

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
  const expectedAttendance = allProfiles
    .filter(p => isDancerRegistered(attMap.get(p.id)))
    .reduce((sum, p) => sum + (credibilityMap.get(p.id) ?? 1.0), 0)

  const dancerRows: DancerRow[] = allProfiles
    .map(p => {
      const att = attMap.get(p.id)
      const name = p.full_name || (p.first_name && p.last_name ? `${p.last_name} ${p.first_name}` : p.name) || 'Névtelen'
      const danceLevel = p.dance_level || p.skill_level || '-'
      const stats = dancerStatsMap.get(p.id) || { registered: 0, attended: 0, paid: 0 }

      // Kiszámítjuk az aktív, lezáratlan hiányzások számát (kronologikus kereséssel)
      const pastAtts = allAttendances
        .filter(a => {
          const pid = a.profile_id || a.user_id
          const isPast = pastEventIds.has(a.event_id)
          const isActive = (a.status ?? '') !== 'cancelled'
          return pid === p.id && isPast && isActive
        })
        .sort((a, b) => {
          const evA = allEventsMap.get(a.event_id)
          const evB = allEventsMap.get(b.event_id)
          const dateA = new Date(evA?.event_date || a.created_at || 0).getTime()
          const dateB = new Date(evB?.event_date || b.created_at || 0).getTime()
          return dateB - dateA
        })

      let activeAbsenceCount = 0
      for (const a of pastAtts) {
        if (a.attended === true && a.paid === true) {
          // Ha megjelent és fizetett, ez lezár minden korábbi hiányzást
          break
        }
        if (a.attended === false) {
          activeAbsenceCount++
        }
      }

      return {
        attendanceId: att?.id,
        profileId: p.id,
        name,
        danceLevel,
        isRegistered: isDancerRegistered(att),
        attended: Boolean(att?.attended),
        paid: Boolean(att?.paid),
        pastRegistered: stats.registered,
        pastAttended: stats.attended,
        pastPaid: stats.paid,
        activeAbsences: activeAbsenceCount
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

  // Csak múltbeli, érvényes jelentkezések megjelenítése az előzményekben
  const selectedDancerHistory = selectedDancerId
    ? allAttendances
        .filter(a => {
          const pid = a.profile_id || a.user_id
          const isPast = pastEventIds.has(a.event_id)
          const isActive = (a.status ?? '') !== 'cancelled'
          return pid === selectedDancerId && isPast && isActive
        })
        .map(a => {
          const ev = allEventsMap.get(a.event_id)
          const rawDate = ev?.event_date || a.created_at
          let formattedDate = 'Ismeretlen dátum'
          if (rawDate) {
            const d = new Date(rawDate)
            if (!isNaN(d.getTime())) {
              formattedDate = d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
            } else {
              formattedDate = String(rawDate)
            }
          }
          return {
            id: a.id,
            title: ev?.title || 'Táncóra',
            date: formattedDate,
            rawDate,
            attended: Boolean(a.attended),
            paid: Boolean(a.paid)
          }
        })
        .sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime())
    : []

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
          <p className="text-xs text-zinc-500">
            Regisztrált: <span className="font-bold text-indigo-600">{registeredCount} fő</span> |{' '}
            Várható részvétel: <span className="font-bold text-emerald-600">{expectedAttendance.toFixed(1)} fő</span>
          </p>
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
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setSelectedDancerId(row.profileId)}
                        className="font-semibold text-zinc-900 text-left hover:text-indigo-600 hover:underline focus:outline-none"
                        title="Kattints az előzmények megtekintéséhez"
                      >
                        {row.name}
                      </button>
                      {/* 1. Fizetési probléma (Tartozás/Elmaradás) */}
                      {row.pastAttended !== undefined && row.pastPaid !== undefined && row.pastAttended > row.pastPaid && (
                        <button
                          onClick={() => setSelectedDancerId(row.profileId)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:scale-105 active:scale-95 transition-transform bg-red-100 text-red-800 border border-red-200 whitespace-nowrap"
                          title="Kattints az elszámolási részletek megtekintéséhez"
                        >
                          {`⚠️ Elmaradás (${row.pastAttended - row.pastPaid})`}
                        </button>
                      )}

                      {/* 2. Túlfizetés */}
                      {row.pastAttended !== undefined && row.pastPaid !== undefined && row.pastPaid > row.pastAttended && (
                        <button
                          onClick={() => setSelectedDancerId(row.profileId)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:scale-105 active:scale-95 transition-transform bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap"
                          title="Kattints a részletek megtekintéséhez"
                        >
                          {`⚠️ Túlfizetés (${row.pastPaid - row.pastAttended})`}
                        </button>
                      )}

                      {/* 3. Távolmaradási probléma (Hiányzás) */}
                      {row.pastRegistered !== undefined && row.pastAttended !== undefined && row.pastRegistered > row.pastAttended && (
                        <button
                          onClick={() => setSelectedDancerId(row.profileId)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:scale-105 active:scale-95 transition-transform bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap"
                          title="Kattints a mulasztási részletek megtekintéséhez"
                        >
                          {`⚠️ Hiányzás (${row.pastRegistered - row.pastAttended})`}
                        </button>
                      )}
                    </div>
                  </td>
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

      {/* TÖRTÉNET MODAL */}
      {selectedDancerId && (() => {
        const selectedDancer = allProfiles.find(p => p.id === selectedDancerId)
        if (!selectedDancer) return null
        const stats = dancerStatsMap.get(selectedDancerId) || { registered: 0, attended: 0, paid: 0 }
        
        // Kiszámítjuk a mulasztási és fizetési arányokat
        const missedCount = stats.registered - stats.attended
        const absencePct = stats.registered > 0 ? Math.round((missedCount / stats.registered) * 100) : 0
        const paymentPct = stats.attended > 0 ? Math.round((stats.paid / stats.attended) * 100) : 100

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200 flex flex-col max-h-[85vh]">
              <div className="bg-zinc-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-bold">Táncos részletes előzményei</h3>
                  <p className="text-xs text-zinc-400">{selectedDancer.full_name || selectedDancer.name} ({selectedDancer.dance_level || '-'})</p>
                </div>
                <button
                  onClick={() => setSelectedDancerId(null)}
                  className="text-zinc-400 hover:text-white transition-colors text-xl font-bold"
                  aria-label="Bezárás"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {/* Statisztikai összesítő */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="text-xs text-zinc-500 font-medium">Jelentkezett</div>
                    <div className="text-lg font-bold text-zinc-800">{stats.registered} alkalom</div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="text-xs text-indigo-600 font-medium">Részt vett</div>
                    <div className="text-lg font-bold text-indigo-700">{stats.attended} alkalom</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="text-xs text-emerald-600 font-medium">Fizetett</div>
                    <div className="text-lg font-bold text-emerald-700">{stats.paid} alkalom</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="text-xs text-rose-600 font-medium">Hiányzási arány</div>
                    <div className="text-lg font-bold text-rose-700">
                      {missedCount} / {stats.registered} ({absencePct}%)
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="text-xs text-zinc-500 font-medium">Fizetési arány</div>
                    <div className="text-lg font-bold text-zinc-800">
                      {paymentPct}%
                    </div>
                  </div>
                </div>

                {/* Táblázat */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase">
                        <th className="py-2.5 px-3">Dátum / Esemény</th>
                        <th className="py-2.5 px-3 text-center">Jelentkezett</th>
                        <th className="py-2.5 px-3 text-center">Részt vett</th>
                        <th className="py-2.5 px-3 text-center">Fizetett</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {selectedDancerHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-zinc-400 italic">
                            Nincs múltbéli, aktív jelentkezési előzmény.
                          </td>
                        </tr>
                      ) : (
                        selectedDancerHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-zinc-800">{h.title}</div>
                              <div className="text-[10px] text-zinc-400">{h.date}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">Igen</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {h.attended ? (
                                <span className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-100">Igen</span>
                              ) : (
                                <span className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-100">Nem</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {h.paid ? (
                                <span className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100">Igen</span>
                              ) : (
                                <span className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-100">Nem</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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