'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadVisibleObjects } from '@/lib/permissions'
import { StatisticsOverview } from './StatisticsOverview'
import { StatisticsDetailed } from './StatisticsDetailed'
import { DancerAttendanceSummary } from './DancerAttendanceSummary'

interface PersonalAttendance {
  id: string
  eventTitle: string
  eventDate: string
  attended: boolean
  paid: boolean
}

type StatSubTab = 'events' | 'dancers'

export function StatisticsDashboard() {
  const [visibleObjects, setVisibleObjects] = useState<Set<string>>(new Set())
  const [subTab, setSubTab] = useState<StatSubTab>('events')
  
  const [events, setEvents] = useState<any[]>([])
  const [detailedData, setDetailedData] = useState<any[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  
  const [rawAttendances, setRawAttendances] = useState<any[]>([])
  const [rawProfiles, setRawProfiles] = useState<any[]>([])

  const [personalHistory, setPersonalHistory] = useState<PersonalAttendance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const permissions = await loadVisibleObjects(profileData?.role)
        setVisibleObjects(permissions)

        const canViewAllStats = permissions.has('stats.all')

        if (!canViewAllStats) {
          const { data: userAttendances } = await supabase
            .from('attendances')
            .select(`
              id,
              attended,
              paid,
              event_name,
              events (
                title,
                event_date
              )
            `)
            .eq('profile_id', user.id)

          if (userAttendances) {
            const history: PersonalAttendance[] = userAttendances.map((att: any) => {
              const ev = att.events
              const rawDate = ev?.event_date || att.event_name
              let formattedDate = ''
              if (rawDate) {
                const d = new Date(rawDate)
                formattedDate = !isNaN(d.getTime())
                  ? d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
                  : String(rawDate)
              }

              return {
                id: att.id,
                eventTitle: ev?.title || att.event_name || 'Esemény',
                eventDate: formattedDate,
                attended: Boolean(att.attended),
                paid: Boolean(att.paid)
              }
            })
            setPersonalHistory(history)
          }
          setLoading(false)
          return
        }

        const [eventsRes, locationsRes, attendancesRes, profilesRes] = await Promise.all([
          supabase.from('events').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('attendances').select('*'),
          supabase.from('profiles').select('*')
        ])

        const allEventsData = eventsRes.data || []
        const locationsData = locationsRes.data || []
        const attendancesData = attendancesRes.data || []
        const profilesData = profilesRes.data || []

        setRawAttendances(attendancesData)
        setRawProfiles(profilesData)

        const toDateKey = (value: any): string => {
          if (!value) return ''
          const d = new Date(value)
          if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          }
          return value.toString().split('T')[0].split(' ')[0]
        }

        const eventStart = (ev: any): Date => {
          const dateKey = toDateKey(ev.event_date)
          const time = (ev.start_time || '00:00').toString().slice(0, 5)
          const dt = new Date(`${dateKey}T${time}:00`)
          return isNaN(dt.getTime()) ? new Date(ev.event_date) : dt
        }

        const now = new Date()
        const eventsData = allEventsData.filter((ev: any) =>
          ev.is_active !== false && eventStart(ev).getTime() >= now.getTime()
        )

        setEvents(eventsData)

        const locationMap = new Map(locationsData.map((l: any) => [l.id, l.name]))
        const profileMap = new Map(profilesData.map((p: any) => [p.id, p]))

        const isFiu = (g: any) => {
          const s = (g || '').toString().toLowerCase()
          return s === 'fiú' || s === 'f' || s === 'male'
        }
        const isLany = (g: any) => {
          const s = (g || '').toString().toLowerCase()
          return s === 'lány' || s === 'l' || s === 'female'
        }

        const agg = {
          totalEvents: eventsData.length,
          totalAttendances: 0,
          f: 0,
          l: 0,
          pairs: 0,
          skill: {} as Record<string, number>
        }

        const formatted = eventsData.map((ev: any) => {
          const eventKey = toDateKey(ev.event_date)

          const evAttendances = attendancesData.filter((a: any) => {
            if (a.event_id && a.event_id === ev.id) return true
            if (a.event && a.event === ev.id) return true
            if (a.event_name && eventKey && toDateKey(a.event_name) === eventKey) return true
            return false
          })

          const seen = new Set<string>()
          const attendeeProfiles: any[] = []
          evAttendances.forEach((att: any) => {
            const prof = profileMap.get(att.profile_id) || profileMap.get(att.user_id) || profileMap.get(att.id)
            if (!prof || seen.has(prof.id)) return
            seen.add(prof.id)
            attendeeProfiles.push(prof)
          })

          const attendingIds = new Set(attendeeProfiles.map((p: any) => p.id))

          const pairedIds = new Set<string>()
          let pairs = 0
          attendeeProfiles.forEach((prof: any) => {
            if (pairedIds.has(prof.id)) return
            const pid = prof.partner_id
            if (pid && attendingIds.has(pid) && !pairedIds.has(pid)) {
              pairedIds.add(prof.id)
              pairedIds.add(pid)
              pairs++
            }
          })

          let fCount = 0
          let lCount = 0
          const attendeeList: any[] = []
          const skillDistribution: Record<string, number> = {}

          attendeeProfiles.forEach((prof: any) => {
            const skillLevel = prof.dance_level || prof.skill_level || prof.level || 'Haladó'
            skillDistribution[skillLevel] = (skillDistribution[skillLevel] || 0) + 1

            attendeeList.push({
              name: prof.full_name || (prof.first_name && prof.last_name ? `${prof.last_name} ${prof.first_name}` : prof.name) || 'Ismeretlen résztvevő',
              skill: skillLevel
            })

            if (!pairedIds.has(prof.id)) {
              if (isFiu(prof.gender)) fCount++
              else if (isLany(prof.gender)) lCount++
            }
          })

          agg.totalAttendances += attendeeProfiles.length
          agg.f += fCount
          agg.l += lCount
          agg.pairs += pairs
          for (const [lvl, n] of Object.entries(skillDistribution)) {
            agg.skill[lvl] = (agg.skill[lvl] || 0) + n
          }

          const locationName = locationMap.get(ev.location_id) || locationMap.get(ev.location) || ev.location_name || 'Helyszín nélkül'
          const possibleDate = ev.event_date || ev.day || ev.start_date || (ev.date && !ev.date.includes(':') ? ev.date : null) || ev.created_at

          let formattedDate = 'Ismeretlen dátum'
          if (possibleDate) {
            try {
              const d = new Date(possibleDate)
              if (!isNaN(d.getTime())) {
                formattedDate = d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
              } else {
                formattedDate = possibleDate.toString().split('T')[0].split(' ')[0]
              }
            } catch {
              formattedDate = possibleDate.toString()
            }
          }

          return {
            date: formattedDate,
            location: locationName,
            fCount,
            lCount,
            pairs,
            attendees: attendeeList,
            skillDistribution
          }
        })

        setDetailedData(formatted)
        setOverview(agg)
      } catch (err) {
        // Csendes hibakezelés
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return <div className="text-zinc-500 p-6">Statisztikák betöltése...</div>
  }

  const canViewAll = visibleObjects.has('stats.all')

  if (!canViewAll) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4 max-w-2xl mx-auto">
        <h3 className="text-lg font-bold text-zinc-900">Saját Jelentkezéseim és Fizetések</h3>

        {personalHistory.length === 0 ? (
          <p className="text-sm text-zinc-500 italic py-4">Még egyetlen eseményre sem jelentkeztél.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase">
                  <th className="py-3 px-2">Esemény</th>
                  <th className="py-3 px-2 text-center">Megjelent</th>
                  <th className="py-3 px-2 text-center">Fizetve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {personalHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50">
                    <td className="py-3 px-2">
                      <div className="font-medium text-zinc-900">{item.eventTitle}</div>
                      <div className="text-xs text-zinc-500">{item.eventDate}</div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {item.attended ? (
                        <span className="text-emerald-600 font-bold">Igen</span>
                      ) : (
                        <span className="text-zinc-400">Nem</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {item.paid ? (
                        <span className="text-emerald-600 font-bold">Igen</span>
                      ) : (
                        <span className="text-zinc-400">Nem</span>
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

  return (
    <div className="space-y-6">
      {/* Sub-tab választó a Statisztikákon belül */}
      <div className="flex gap-2 border-b border-zinc-200 pb-3">
        <button
          onClick={() => setSubTab('events')}
          className={`py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
            subTab === 'events'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          Alkalmak szerinti bontás
        </button>
        <button
          onClick={() => setSubTab('dancers')}
          className={`py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
            subTab === 'dancers'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          Táncosok szerinti bontás
        </button>
      </div>

      {subTab === 'events' && (
        <>
          <StatisticsOverview
            stats={events}
            summary={overview}
            data={detailedData}
            visibleObjects={visibleObjects}
            onRowSelect={setSelectedEvent}
          />
          {visibleObjects.has('stats.detailed') && (
            <StatisticsDetailed
              selectedEvent={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}
        </>
      )}

      {subTab === 'dancers' && (
        <DancerAttendanceSummary
          attendancesData={rawAttendances}
          profilesData={rawProfiles}
        />
      )}
    </div>
  )
}