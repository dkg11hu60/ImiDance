'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { loadVisibleObjects } from '@/lib/permissions'
import { StatisticsOverview } from './StatisticsOverview'
import { StatisticsDetailed } from './StatisticsDetailed'

export function StatisticsDashboard() {
  const [visibleObjects, setVisibleObjects] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<any[]>([])
  const [detailedData, setDetailedData] = useState<any[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          setVisibleObjects(await loadVisibleObjects(profileData?.role))
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

          // 1. Párok azonosítása
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

          // 2. Pár nélküli fiúk és lányok számítása (összes fiú/lány mínusz n pár)
          let fCount = 0
          let lCount = 0
          const attendeeList: any[] = []
          const skillDistribution: Record<string, number> = {}

          attendeeProfiles.forEach((prof: any) => {
            const skillLevel = prof.dance_level || prof.skill_level || prof.level || 'Haladó'
            skillDistribution[skillLevel] = (skillDistribution[skillLevel] || 0) + 1

            attendeeList.push({
              name: prof.full_name || prof.name || 'Ismeretlen résztvevő',
              skill: skillLevel
            })

            // Ha a résztvevő nem képezi részét egy jelen lévő párnak, beleszámít a különálló F / L létszámba
            if (!pairedIds.has(prof.id)) {
              if (isFiu(prof.gender)) fCount++
              else if (isLany(prof.gender)) lCount++
            }
          })

          // Aggregált adatok frissítése
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

  return (
    <div className="space-y-6">
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
    </div>
  )
}