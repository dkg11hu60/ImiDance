'use client'
// useStatisticsData.ts — v007: status jelentés tisztázva. Jelentkező = status <> 'cancelled'.
// Megjelenés = attended (bool), fizetés = paid (bool). Halott 'present'/'payment_status' ág törölve.

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { DanceStat, EventStat, PersonStat } from './types'

// v003 — profiles.dance_level tényleges értékkészlete → DanceStat oszlop.
// DB eloszlás: Hobbi, Haladó, SzuperH, ExtraH. Kulcs normalizálva (trim + lowercase).
const LEVEL_COLUMN: Record<string, 'h' | 'sz' | 'ex' | 'hobbi'> = {
  'haladó': 'h',
  'szuperh': 'sz',
  'extrah': 'ex',
  'hobbi': 'hobbi',
}

// v005 — partner azonosító a profil rekordból. Ha a sémádban más a neve, ide vedd fel egy sorral.
function getPartnerId(p: any): string | null {
  const v = p?.partner_id ?? p?.par_id ?? p?.partner_profile_id ?? p?.couple_id ?? null
  return v != null ? String(v) : null
}

// v006 — egy csoport (dátum+időpont) jelenlévői közül a KÖLCSÖNÖS párok száma.
// Pár = A és B is jelen van, A.partner_id = B.id ÉS B.partner_id = A.id.
function countPairs(present: any[]): number {
  const byId = new Map<string, any>()
  present.forEach((p) => { if (p?.id != null) byId.set(String(p.id), p) })

  const used = new Set<string>()
  let pairs = 0

  for (const p of present) {
    const aid = String(p?.id ?? '')
    if (!aid || used.has(aid)) continue

    const bid = getPartnerId(p)
    if (!bid || bid === aid || used.has(bid) || !byId.has(bid)) continue

    const b = byId.get(bid)
    if (getPartnerId(b) !== aid) continue // kölcsönösség kötelező

    pairs++
    used.add(aid)
    used.add(bid)
  }
  return pairs
}

// v007 — egy jelentkezés akkor "élő" (a nevezőbe számít), ha nem lemondott.
function isActiveRegistration(a: any): boolean {
  return (a?.status ?? '') !== 'cancelled'
}

export function useStatisticsData() {
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false)

  const [danceStats, setDanceStats] = useState<DanceStat[]>([])
  const [eventStats, setEventStats] = useState<EventStat[]>([])
  const [personStats, setPersonStats] = useState<PersonStat[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const { data: allowedObjects, error: permErr } = await supabase.rpc('get_my_allowed_objects')

        if (permErr) {
          throw new Error(`Jogosultság-ellenőrzési hiba: ${permErr.message}`)
        }

        const allowedKeys = (allowedObjects || []).map((item: { object_key: string }) => item.object_key)
        const hasAccess = allowedKeys.includes('stats.all') || allowedKeys.includes('stats.detailed')

        setIsAuthorized(hasAccess)

        if (!hasAccess) {
          setLoading(false)
          return
        }

        // Globális adatok lekérése RPC-n keresztül (megkerüli a felhasználói RLS szűrést)
        const { data: globalData, error: globalErr } = await supabase.rpc('get_global_statistics_data')

        if (globalErr) throw new Error(`Globális adatok hiba: ${globalErr.message}`)

        const rawEvents = globalData?.events || []
        const rawAttendances = globalData?.attendances || []
        const rawProfiles = globalData?.profiles || []

// --- 1. TAB: Táncesemények Összesítő (danceStats) ---
        const danceGroupMap: { [key: string]: DanceStat } = {}
        // v005 — csoportonként a jelen lévő profilok, hogy utólag valódi párt tudjunk számolni
        const presentByGroup: { [key: string]: any[] } = {}

        rawEvents.forEach((ev: any) => {
          const dateStr = ev.event_date ? new Date(ev.event_date).toISOString().split('T')[0] : 'Ismeretlen'
          const timeStr = ev.start_time ? ev.start_time.substring(0, 5) : '00:00'
          const groupKey = `${dateStr}_${timeStr}`

          if (!danceGroupMap[groupKey]) {
            danceGroupMap[groupKey] = {
              datum: dateStr,
              idopont: timeStr,
              f: 0,
              l: 0,
              p: 0,
              h: 0,
              sz: 0,
              ex: 0,
              hobbi: 0,
              Össz: 0
            }
            presentByGroup[groupKey] = []
          }

          // v007 — a Táncesemények Összesítő az ÉLŐ (nem lemondott) jelentkezéseket számolja
          const eventAtts = rawAttendances.filter((att: any) => att.event_id === ev.id && isActiveRegistration(att))
          eventAtts.forEach((att: any) => {
            const profile = rawProfiles.find((p: any) => p.id === att.profile_id)
            if (profile) {
              // f és l itt a NYERS nemenkénti totál (a párlevonás a csoport-pass-ben történik)
              const gender = (profile.gender || '').toLowerCase()
              if (gender.includes('m') || gender.includes('fiú') || gender.includes('f')) danceGroupMap[groupKey].f++
              else if (gender.includes('l') || gender.includes('lány')) danceGroupMap[groupKey].l++

              // v003 — explicit, normalizált szint-leképezés; ismeretlen szint egyik oszlopba sem esik
              const level = (profile.dance_level || '').trim().toLowerCase()
              const col = LEVEL_COLUMN[level]
              if (col) danceGroupMap[groupKey][col]++

              danceGroupMap[groupKey].Össz++
              presentByGroup[groupKey].push(profile)
            }
          })
        })

        // v006 — csoportonként EGYSZER: P = kölcsönös, jelenlévő párok; F* = F − P, L* = L − P.
        Object.keys(danceGroupMap).forEach((k) => {
          const g = danceGroupMap[k]
          const p = countPairs(presentByGroup[k] || [])
          g.p = p
          g.f = Math.max(0, g.f - p)
          g.l = Math.max(0, g.l - p)
        })

        setDanceStats(Object.values(danceGroupMap))

        // --- 2. TAB: Események szerinti bontás (eventStats) ---
        let totalJelentkezett = 0
        let totalMegjelent = 0
        let totalFizetettMegjelent = 0

        const computedEventStats: EventStat[] = rawEvents.map((ev: any) => {
          // v007 — jelentkező = élő (nem lemondott); megjelenés = attended; fizetés = paid
          const eventAtts = rawAttendances.filter((att: any) => att.event_id === ev.id && isActiveRegistration(att))
          const jelentkezett = eventAtts.length
          const megjelent = eventAtts.filter((a: any) => a.attended === true).length
          const fizetettMegjelent = eventAtts.filter((a: any) => a.attended === true && a.paid === true).length

          totalJelentkezett += jelentkezett
          totalMegjelent += megjelent
          totalFizetettMegjelent += fizetettMegjelent

          const megArany = jelentkezett > 0 ? Math.round((megjelent / jelentkezett) * 100) : 0
          const fizArany = megjelent > 0 ? Math.round((fizetettMegjelent / megjelent) * 100) : 0

          return {
            event_id: ev.id,
            event_title: ev.title || 'Névtelen esemény',
            event_date: ev.event_date ? new Date(ev.event_date).toISOString().split('T')[0] : '',
            jelentkezett_count: jelentkezett,
            megjelent_count: megjelent,
            fizetett_megjelent_count: fizetettMegjelent,
            megjelenesi_arany: `${megArany}%`,
            fizetesi_arany: `${fizArany}%`
          }
        })

        const totalMegArany = totalJelentkezett > 0 ? Math.round((totalMegjelent / totalJelentkezett) * 100) : 0
        const totalFizArany = totalMegjelent > 0 ? Math.round((totalFizetettMegjelent / totalMegjelent) * 100) : 0

        computedEventStats.push({
          event_id: 'TOTAL',
          event_title: 'ÖSSZESEN / ÁTLAG',
          event_date: '',
          jelentkezett_count: totalJelentkezett,
          megjelent_count: totalMegjelent,
          fizetett_megjelent_count: totalFizetettMegjelent,
          megjelenesi_arany: `${totalMegArany}%`,
          fizetesi_arany: `${totalFizArany}%`
        })

        setEventStats(computedEventStats)

        // --- 3. TAB: Személyek szerinti bontás (personStats) ---
        let personTotalJelentkezes = 0
        let personTotalMegjelent = 0
        let personTotalFizetettMegjelent = 0

        const computedPersonStats: PersonStat[] = rawProfiles.map((prof: any) => {
          // v007 — személyenként is: élő jelentkezés a nevező, megjelenés = attended, fizetés = paid
          const userAtts = rawAttendances.filter((att: any) => att.profile_id === prof.id && isActiveRegistration(att))
          const jelentkezesek = userAtts.length
          const megjelent = userAtts.filter((a: any) => a.attended === true).length
          const fizetettMegjelent = userAtts.filter((a: any) => a.attended === true && a.paid === true).length

          personTotalJelentkezes += jelentkezesek
          personTotalMegjelent += megjelent
          personTotalFizetettMegjelent += fizetettMegjelent

          const megArany = jelentkezesek > 0 ? Math.round((megjelent / jelentkezesek) * 100) : 0
          const fizArany = megjelent > 0 ? Math.round((fizetettMegjelent / megjelent) * 100) : 0

          return {
            profile_id: prof.id,
            full_name: prof.full_name || prof.email || 'Névtelen',
            email: prof.email || '',
            osszes_jelentkezes: jelentkezesek,
            osszes_megjelent: megjelent,
            osszes_fizetett_megjelent: fizetettMegjelent,
            megjelenesi_arany: `${megArany}%`,
            fizetesi_arany: `${fizArany}%`
          }
        })

        const personTotalMegArany = personTotalJelentkezes > 0 ? Math.round((personTotalMegjelent / personTotalJelentkezes) * 100) : 0
        const personTotalFizArany = personTotalMegjelent > 0 ? Math.round((personTotalFizetettMegjelent / personTotalMegjelent) * 100) : 0

        computedPersonStats.push({
          profile_id: 'TOTAL',
          full_name: 'ÖSSZESEN / ÁTLAG',
          email: '',
          osszes_jelentkezes: personTotalJelentkezes,
          osszes_megjelent: personTotalMegjelent,
          osszes_fizetett_megjelent: personTotalFizetettMegjelent,
          megjelenesi_arany: `${personTotalMegArany}%`,
          fizetesi_arany: `${personTotalFizArany}%`
        })

        setPersonStats(computedPersonStats)

      } catch (err: any) {
        console.error('Hiba a useStatisticsData futása során:', err)
        setError(err.message || 'Ismeretlen hiba történt.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return {
    loading,
    error,
    isAuthorized,
    danceStats,
    eventStats,
    personStats
  }
}