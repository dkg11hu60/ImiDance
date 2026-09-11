'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useStatisticsData } from './useStatisticsData'
import { Attendee, DanceStat, EventStat, PersonStat } from './types'
import { MyAttendance } from '../MyAttendance'
import { DancerAttendanceSummary } from './DancerAttendanceSummary'

interface StatisticsDashboardProps {
  mode?: 'jelentesek' | 'reszvétel'
  userId?: string
}

export default function StatisticsDashboard({ mode = 'jelentesek', userId }: StatisticsDashboardProps) {
  const { loading, error, isAuthorized, danceStats, eventStats, personStats, rawEvents, rawAttendances, rawProfiles } = useStatisticsData()

  // Engedélyezett objektumok (app_objects kulcsok) tárolása
  const [allowedObjects, setAllowedObjects] = useState<string[]>([])
  const [loadingPermissions, setLoadingPermissions] = useState<boolean>(true)

  const [activeTab, setActiveTab] = useState<
    'dance_events' | 'events_breakdown' | 'persons_breakdown' | 'my_attendance' | 'dancers_summary'
  >(mode === 'reszvétel' ? 'my_attendance' : 'dance_events')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Modal állapotok
  const [selectedRow, setSelectedRow] = useState<{ datum: string; idopont: string; title?: string } | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loadingAttendees, setLoadingAttendees] = useState<boolean>(false)

  // Rendezési állapotok (külön mindhárom táblázathoz)
  const [sortField, setSortField] = useState<keyof DanceStat>('datum')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const [eventSortField, setEventSortField] = useState<keyof EventStat>('event_title')
  const [eventSortDirection, setEventSortDirection] = useState<'asc' | 'desc'>('asc')

  const [personSortField, setPersonSortField] = useState<keyof PersonStat>('full_name')
  const [personSortDirection, setPersonSortDirection] = useState<'asc' | 'desc'>('asc')

  const [attendeeSortField, setAttendeeSortField] = useState<keyof Attendee>('nev')
  const [attendeeSortDirection, setAttendeeSortDirection] = useState<'asc' | 'desc'>('asc')

  // --- JOGOSULTSÁGOK LEKÉRDEZÉSE (get_my_allowed_objects) ---
  useEffect(() => {
    const fetchAllowedObjects = async () => {
      try {
        setLoadingPermissions(true)
        const { data, error: permErr } = await supabase.rpc('get_my_allowed_objects')
        if (permErr) throw permErr

        const keys = (data || []).map((item: { object_key: string }) => item.object_key)
        setAllowedObjects(keys)

        // Első elérhető fül aktiválása
        if (mode === 'reszvétel') {
          setActiveTab('my_attendance')
        } else if (keys.includes('stats.all')) {
          setActiveTab('dance_events')
        } else if (keys.includes('stats.detailed')) {
          setActiveTab('events_breakdown')
        }
      } catch (err: any) {
        console.error('Hiba a jogosultságok betöltésekor:', err.message)
      } finally {
        setLoadingPermissions(false)
      }
    }

    fetchAllowedObjects()
  }, [mode])

  // Definiáljuk a fülek konfigurációját az app_objects kulcsokkal
  const ALL_TABS = mode === 'reszvétel'
    ? [
        {
          id: 'my_attendance',
          requiredObject: 'stats.detailed',
          label: 'Saját',
          subtitle: 'Kizárólag a te adataid'
        },
        {
          id: 'events_breakdown',
          requiredObject: 'stats.detailed',
          label: 'Események',
          subtitle: 'Részvétel eseményenként'
        },
        {
          id: 'persons_breakdown',
          requiredObject: 'stats.detailed',
          label: 'Személyek',
          subtitle: 'Részvétel személyenként'
        },
        {
          id: 'dancers_summary',
          requiredObject: 'stats.detailed',
          label: 'Részletes',
          subtitle: 'Összesített kimutatás szűrőkkel'
        }
      ]
    : [
        {
          id: 'dance_events',
          requiredObject: 'stats.all',
          label: 'Táncesemények Összesítő',
          subtitle: 'Jövőbeli táncesemények'
        }
      ]

  // Csak azok a fülek láthatók, amelyekhez megvan az engedélyezett app_object kulcs
  const visibleTabs = ALL_TABS.filter((tab) => allowedObjects.includes(tab.requiredObject))

  // --- RENDEZÉSI HANDLEREK ---
  const handleSort = (field: keyof DanceStat) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
  }

  const handleEventSort = (field: keyof EventStat) => {
    if (eventSortField === field) setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc')
    else { setEventSortField(field); setEventSortDirection('asc') }
  }

  const handlePersonSort = (field: keyof PersonStat) => {
    if (personSortField === field) setPersonSortDirection(personSortDirection === 'asc' ? 'desc' : 'asc')
    else { setPersonSortField(field); setPersonSortDirection('asc') }
  }

  const handleAttendeeSort = (field: keyof Attendee) => {
    if (attendeeSortField === field) setAttendeeSortDirection(attendeeSortDirection === 'asc' ? 'desc' : 'asc')
    else { setAttendeeSortField(field); setAttendeeSortDirection('asc') }
  }

  const handleRowClick = async (row: any) => {
    // Ha a felhasználónak nincs megfelelő statisztikai jogosultsága, ne történjen semmi
    if (!allowedObjects.includes('stats.all') && !allowedObjects.includes('stats.detailed')) return

    // Ha az összesítés / átlag sorra kattintottak, ne nyíljon meg a modal
    if (row.event_id === 'TOTAL') return

    const datum = 'datum' in row ? row.datum : row.event_date
    const idopont = row.idopont
    const title = 'event_title' in row ? row.event_title : undefined

    if (!datum || !idopont) return

    setSelectedRow({ datum, idopont, title })
    setLoadingAttendees(true)
    setAttendees([])
    setAttendeeSortField('nev')
    setAttendeeSortDirection('asc')

    try {
      // Megkeressük az adott eseményhez tartozó jelentkezéseket a helyi rawAttendances táblából
      let eventAtts = []
      if (row.event_id) {
        eventAtts = rawAttendances.filter((att: any) => att.event_id === row.event_id)
      } else {
        // Ha nincs konkrét event_id, akkor megkeressük azokat az eseményeket, amik az adott dátumra és időpontra esnek
        const matchingEventIds = rawEvents
          .filter((ev: any) => {
            const evDate = ev.event_date ? new Date(ev.event_date).toISOString().split('T')[0] : ''
            const evTime = ev.start_time ? ev.start_time.substring(0, 5) : ''
            return evDate === datum && evTime === idopont
          })
          .map((ev: any) => ev.id)
        
        eventAtts = rawAttendances.filter((att: any) => matchingEventIds.includes(att.event_id))
      }

      // Összekötjük a profilokkal és kigyűjtjük az információkat
      const localAttendees = eventAtts.map((att: any) => {
        const prof = rawProfiles.find((p: any) => p.id === att.profile_id)
        return {
          nev: prof?.full_name || prof?.name || prof?.email || 'Névtelen',
          nem: prof?.gender || '—',
          par_neve: prof ? (rawProfiles.find((p: any) => p.id === prof.partner_id)?.full_name || null) : null,
          tudasszint: prof?.dance_level || '—',
          jelentkezett: (att.status ?? '') !== 'cancelled',
          megjelent: att.attended === true,
          fizetett: att.paid === true
        }
      })

      setAttendees(localAttendees)
    } catch (err: any) {
      console.error('Hiba a jelentkezők feldolgozásakor:', err.message)
    } finally {
      setLoadingAttendees(false)
    }
  }

  // --- ADATFELDOLGOZÁS ---
  const sortedDanceStats = [...danceStats]
    .filter((item) =>
      item.datum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.idopont.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal, 'hu') : bVal.localeCompare(aVal, 'hu')
      }
      return sortDirection === 'asc' ? (Number(aVal) || 0) - (Number(bVal) || 0) : (Number(bVal) || 0) - (Number(aVal) || 0)
    })

  const totalEventRow = eventStats.find((item) => item.event_id === 'TOTAL')
  const sortedEvents = eventStats
    .filter((item) => item.event_id !== 'TOTAL' && item.event_title?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[eventSortField] ?? ''
      const bVal = b[eventSortField] ?? ''
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return eventSortDirection === 'asc' ? aVal.localeCompare(bVal, 'hu') : bVal.localeCompare(aVal, 'hu')
      }
      return eventSortDirection === 'asc' ? (Number(aVal) || 0) - (Number(bVal) || 0) : (Number(bVal) || 0) - (Number(aVal) || 0)
    })

  const totalPersonRow = personStats.find((item) => item.profile_id === 'TOTAL')
  const sortedPersons = personStats
    .filter(
      (item) =>
        item.profile_id !== 'TOTAL' &&
        (item.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const aVal = a[personSortField] ?? ''
      const bVal = b[personSortField] ?? ''
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return personSortDirection === 'asc' ? aVal.localeCompare(bVal, 'hu') : bVal.localeCompare(aVal, 'hu')
      }
      return personSortDirection === 'asc' ? (Number(aVal) || 0) - (Number(bVal) || 0) : (Number(bVal) || 0) - (Number(aVal) || 0)
    })

  const sortedAttendees = [...attendees].sort((a, b) => {
    const aVal = String(a[attendeeSortField] || '')
    const bVal = String(b[attendeeSortField] || '')
    return attendeeSortDirection === 'asc' ? aVal.localeCompare(bVal, 'hu') : bVal.localeCompare(aVal, 'hu')
  })

  if (loading || loadingPermissions) {
    return <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Statisztikai adatok és jogosultságok betöltése...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200">Hiba: {error}</div>
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500">
        Nincs jogosultságod egyik statisztikai nézet megtekintéséhez sem.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Fejléc */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'reszvétel' ? 'Részvételi Statisztikák' : 'Jelentkezések'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'reszvétel'
              ? 'Saját és iskolai szintű részvételi adatok.'
              : isAuthorized
                ? 'Kattints bármelyik táncesemény sorra a jelentkezők megtekintéséhez.'
                : 'Részletes kimutatások a jelentkezőkről.'}
          </p>
        </div>
        {activeTab !== 'my_attendance' && activeTab !== 'dancers_summary' && (
          <input
            type="text"
            placeholder="Keresés..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 w-full md:w-64"
          />
        )}
      </div>

      {/* Dinamikus Menü / Fülek (csak ha egynél több fül látható) */}
      {visibleTabs.length > 1 && (
        <div className="flex border-b border-slate-200 mb-6 gap-2 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* TAB: SAJÁT RÉSZVÉTEL */}
      {activeTab === 'my_attendance' && (
        <MyAttendance userId={userId} />
      )}

      {/* TAB 1: TÁNCESEMÉNYEK */}
      {activeTab === 'dance_events' && allowedObjects.includes('stats.all') && (
        <div className="overflow-x-auto shadow-xl rounded-2xl border border-slate-200 bg-white max-h-[75vh] overflow-y-auto relative">
          <table className="min-w-full divide-y divide-slate-200 text-sm border-collapse">
            <thead className="bg-slate-900 text-slate-100 text-xs tracking-wider sticky top-0 z-20 shadow-sm">
              <tr>
                <th onClick={() => handleSort('datum')} className="px-4 py-3.5 text-left font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Dátum {sortField === 'datum' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleSort('idopont')} className="px-4 py-3.5 text-left font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Időpont {sortField === 'idopont' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleSort('f')} className="px-4 py-3.5 text-center font-semibold bg-blue-950 text-blue-200 cursor-pointer hover:bg-blue-900 select-none">
                  Fiú {sortField === 'f' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleSort('l')} className="px-4 py-3.5 text-center font-semibold bg-rose-950 text-rose-200 cursor-pointer hover:bg-rose-900 select-none">
                  Lány {sortField === 'l' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleSort('p')} className="px-4 py-3.5 text-center font-semibold bg-indigo-950 text-indigo-200 cursor-pointer hover:bg-indigo-900 select-none">
                  Pár {sortField === 'p' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleSort('h')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">H {sortField === 'h' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                <th onClick={() => handleSort('sz')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">Sz {sortField === 'sz' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                <th onClick={() => handleSort('ex')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">Ex {sortField === 'ex' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                <th onClick={() => handleSort('hobbi')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">Hobbi {sortField === 'hobbi' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}</th>
                <th onClick={() => handleSort('Össz')} className="px-4 py-3.5 text-center font-semibold bg-slate-800 text-amber-300 cursor-pointer hover:bg-slate-700 select-none">
                  Összesen {sortField === 'Össz' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleSort('varhato')} className="px-4 py-3.5 text-center font-semibold bg-indigo-900 text-amber-200 cursor-pointer hover:bg-indigo-800 select-none">
                  Várható {sortField === 'varhato' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
               {sortedDanceStats.map((row, index) => (
              <tr
                key={index}
                className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} ${
                  allowedObjects.includes('stats.all') 
                    ? 'cursor-pointer hover:bg-indigo-100/70' 
                    : 'cursor-default'
                } transition-colors`}
                onClick={() => handleRowClick(row)}
              >
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.datum}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.idopont}</td>
                <td className="px-4 py-3 text-center font-medium bg-blue-50/30 text-blue-900">{row.f}</td>
                <td className="px-4 py-3 text-center font-medium bg-rose-50/30 text-rose-900">{row.l}</td>
                <td className="px-4 py-3 text-center font-bold bg-indigo-50/30 text-indigo-700">{row.p}</td>
                <td className="px-4 py-3 text-center">{row.h}</td>
                <td className="px-4 py-3 text-center">{row.sz}</td>
                <td className="px-4 py-3 text-center">{row.ex}</td>
                <td className="px-4 py-3 text-center">{row.hobbi}</td>
                <td className="px-4 py-3 text-center font-extrabold bg-slate-100 text-slate-900 shadow-inner">{row.Össz}</td>
                <td className="px-4 py-3 text-center font-extrabold bg-indigo-50 text-indigo-900 shadow-inner">{row.varhato !== undefined ? `${row.varhato.toFixed(1)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: ESEMÉNYEK BONTÁS */}
      {activeTab === 'events_breakdown' && allowedObjects.includes('stats.detailed') && (
        <div className="overflow-x-auto shadow-xl rounded-2xl border border-slate-200 bg-white max-h-[75vh] overflow-y-auto relative">
          <table className="min-w-full divide-y divide-slate-200 text-sm border-collapse">
            <thead className="bg-slate-900 text-slate-100 text-xs tracking-wider sticky top-0 z-20 shadow-sm">
              <tr>
                <th onClick={() => handleEventSort('event_title')} className="px-4 py-3.5 text-left font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Esemény neve {eventSortField === 'event_title' && (eventSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleEventSort('event_date')} className="px-4 py-3.5 text-left font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Dátum {eventSortField === 'event_date' && (eventSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleEventSort('jelentkezett_count')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Jelentkezett {eventSortField === 'jelentkezett_count' && (eventSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleEventSort('megjelent_count')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Megjelent {eventSortField === 'megjelent_count' && (eventSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleEventSort('fizetett_megjelent_count')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Fizetett & Megjelent {eventSortField === 'fizetett_megjelent_count' && (eventSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleEventSort('megjelenesi_arany')} className="px-4 py-3.5 text-center font-semibold text-blue-400 cursor-pointer hover:bg-slate-800 select-none">
                  Megjelenési arány {eventSortField === 'megjelenesi_arany' && (eventSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handleEventSort('fizetesi_arany')} className="px-4 py-3.5 text-center font-semibold text-emerald-400 cursor-pointer hover:bg-slate-800 select-none">
                  Fizetési arány {eventSortField === 'fizetesi_arany' && (eventSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {sortedEvents.map((row, index) => (
                <tr 
                  key={row.event_id} 
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} ${
                    allowedObjects.includes('stats.detailed') 
                      ? 'cursor-pointer hover:bg-indigo-100/70' 
                      : 'cursor-default'
                  } transition-colors`}
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{row.event_title}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.event_date ? new Date(row.event_date).toLocaleDateString('hu-HU') : '-'}</td>
                  <td className="px-4 py-3 text-center">{row.jelentkezett_count}</td>
                  <td className="px-4 py-3 text-center">{row.megjelent_count}</td>
                  <td className="px-4 py-3 text-center">{row.fizetett_megjelent_count}</td>
                  <td className="px-4 py-3 text-center font-semibold text-blue-600">{row.megjelenesi_arany}</td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-600">{row.fizetesi_arany}</td>
                </tr>
              ))}
            </tbody>
            {totalEventRow && (
              <tfoot className="bg-indigo-50 font-bold border-t-2 border-indigo-200 sticky bottom-0 z-10 shadow-lg">
                <tr>
                  <td className="px-4 py-3 text-indigo-900">{totalEventRow.event_title}</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3 text-center">{totalEventRow.jelentkezett_count}</td>
                  <td className="px-4 py-3 text-center">{totalEventRow.megjelent_count}</td>
                  <td className="px-4 py-3 text-center">{totalEventRow.fizetett_megjelent_count}</td>
                  <td className="px-4 py-3 text-center text-blue-700 font-extrabold">{totalEventRow.megjelenesi_arany}</td>
                  <td className="px-4 py-3 text-center text-emerald-700 font-extrabold">{totalEventRow.fizetesi_arany}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* TAB 3: SZEMÉLYEK BONTÁS */}
      {activeTab === 'persons_breakdown' && allowedObjects.includes('stats.detailed') && (
        <div className="overflow-x-auto shadow-xl rounded-2xl border border-slate-200 bg-white max-h-[75vh] overflow-y-auto relative">
          <table className="min-w-full divide-y divide-slate-200 text-sm border-collapse">
            <thead className="bg-slate-900 text-slate-100 text-xs tracking-wider sticky top-0 z-20 shadow-sm">
              <tr>
                <th onClick={() => handlePersonSort('full_name')} className="px-4 py-3.5 text-left font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Név {personSortField === 'full_name' && (personSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handlePersonSort('email')} className="px-4 py-3.5 text-left font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  E-mail {personSortField === 'email' && (personSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handlePersonSort('osszes_jelentkezes')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Jelentkezések {personSortField === 'osszes_jelentkezes' && (personSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handlePersonSort('osszes_megjelent')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Megjelent {personSortField === 'osszes_megjelent' && (personSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handlePersonSort('osszes_fizetett_megjelent')} className="px-4 py-3.5 text-center font-semibold cursor-pointer hover:bg-slate-800 select-none">
                  Fizetett & Megjelent {personSortField === 'osszes_fizetett_megjelent' && (personSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handlePersonSort('megjelenesi_arany')} className="px-4 py-3.5 text-center font-semibold text-blue-400 cursor-pointer hover:bg-slate-800 select-none">
                  Megbízhatóság (Credibility) {personSortField === 'megjelenesi_arany' && (personSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
                <th onClick={() => handlePersonSort('fizetesi_arany')} className="px-4 py-3.5 text-center font-semibold text-emerald-400 cursor-pointer hover:bg-slate-800 select-none">
                  Fizetési arány {personSortField === 'fizetesi_arany' && (personSortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {sortedPersons.map((row) => (
                <tr key={row.profile_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{row.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.email || '-'}</td>
                  <td className="px-4 py-3 text-center">{row.osszes_jelentkezes}</td>
                  <td className="px-4 py-3 text-center">{row.osszes_megjelent}</td>
                  <td className="px-4 py-3 text-center">{row.osszes_fizetett_megjelent}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold min-w-[55px] ${getAppearanceRateStyle(row.megjelenesi_arany)}`}>
                      {row.megjelenesi_arany}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold min-w-[55px] ${getPaymentRateStyle(row.fizetesi_arany)}`}>
                      {row.fizetesi_arany}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {totalPersonRow && (
              <tfoot className="bg-indigo-50 font-bold border-t-2 border-indigo-200 sticky bottom-0 z-10 shadow-lg">
                <tr>
                  <td className="px-4 py-3 text-indigo-900">{totalPersonRow.full_name}</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3 text-center">{totalPersonRow.osszes_jelentkezes}</td>
                  <td className="px-4 py-3 text-center">{totalPersonRow.osszes_megjelent}</td>
                  <td className="px-4 py-3 text-center">{totalPersonRow.osszes_fizetett_megjelent}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-extrabold min-w-[55px] ${getAppearanceRateStyle(totalPersonRow.megjelenesi_arany)}`}>
                      {totalPersonRow.megjelenesi_arany}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-extrabold min-w-[55px] ${getPaymentRateStyle(totalPersonRow.fizetesi_arany)}`}>
                      {totalPersonRow.fizetesi_arany}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* TAB 4: SZEMÉLYEK BONTÁS (RÉSZLETES / SZŰRHETŐ) */}
      {activeTab === 'dancers_summary' && allowedObjects.includes('stats.detailed') && (
        <DancerAttendanceSummary
          attendancesData={rawAttendances}
          profilesData={rawProfiles}
          eventsData={rawEvents}
        />
      )}

      {/* RÉSZTVEVŐ MODAL */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold">Jelentkezők listája</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedRow.datum} | {selectedRow.idopont}
                </p>
              </div>
              <button onClick={() => setSelectedRow(null)} className="text-slate-400 hover:text-white text-xl font-bold px-2 py-1">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {loadingAttendees ? (
                <div className="py-12 text-center text-slate-500 font-medium animate-pulse">Betöltés...</div>
              ) : sortedAttendees.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs tracking-wider sticky top-0 z-10">
                    <tr>
                      <th onClick={() => handleAttendeeSort('nev')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-200 select-none">
                        Név {attendeeSortField === 'nev' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th onClick={() => handleAttendeeSort('nem')} className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-slate-200 select-none">
                        Nem {attendeeSortField === 'nem' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th onClick={() => handleAttendeeSort('par_neve')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-200 select-none">
                        Párja {attendeeSortField === 'par_neve' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-4 py-3 text-center font-semibold select-none">
                        Jelentkezett?
                      </th>
                      <th className="px-4 py-3 text-center font-semibold select-none">
                        Megjelent?
                      </th>
                      <th className="px-4 py-3 text-center font-semibold select-none">
                        Fizetett?
                      </th>
                      <th onClick={() => handleAttendeeSort('tudasszint')} className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-slate-200 select-none">
                        Tudásszint {attendeeSortField === 'tudasszint' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {sortedAttendees.map((att, i) => (
                      <tr key={i} className="hover:bg-indigo-50/40">
                        <td className="px-4 py-3 font-semibold text-slate-900">{att.nev}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${att.nem === 'F' || att.nem === 'Fiú' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                            {att.nem || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{att.par_neve || <span className="text-slate-400 italic">Nincs párja</span>}</td>
                        <td className="px-4 py-3 text-center">
                          {att.jelentkezett ? (
                            <span className="inline-flex px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Igen</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded font-medium bg-rose-50 text-rose-600 border border-rose-200">Nem</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {att.megjelent ? (
                            <span className="inline-flex px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Igen</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded font-medium bg-rose-50 text-rose-600 border border-rose-200">Nem</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {att.fizetett ? (
                            <span className="inline-flex px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Igen</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded font-medium bg-rose-50 text-rose-600 border border-rose-200">Nem</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800">{att.tudasszint || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-400 italic">Ehhez az időponthoz nincsenek jelentkezők.</div>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
              <button onClick={() => setSelectedRow(null)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold">Bezárás</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getAppearanceRateStyle(rateStr: string): string {
  if (!rateStr || rateStr === '—') return 'bg-slate-100 text-slate-500 border border-slate-200'
  const val = parseInt(rateStr.replace('%', ''), 10)
  if (isNaN(val)) return 'bg-slate-100 text-slate-500 border border-slate-200'

  if (val >= 90) return 'bg-emerald-100 text-emerald-800 border border-emerald-200'  // Level 5 (90-100)
  if (val >= 70) return 'bg-green-100 text-green-800 border border-green-200'         // Level 4 (70-89)
  if (val >= 50) return 'bg-yellow-100 text-yellow-800 border border-yellow-200'       // Level 3 (50-69)
  if (val >= 30) return 'bg-orange-100 text-orange-800 border border-orange-200'       // Level 2 (30-49)
  return 'bg-red-100 text-red-800 border border-red-200'                             // Level 1 (0-29)
}

function getPaymentRateStyle(rateStr: string): string {
  if (!rateStr || rateStr === '—') return 'bg-slate-100 text-slate-500 border border-slate-200'
  const val = parseInt(rateStr.replace('%', ''), 10)
  if (isNaN(val)) return 'bg-slate-100 text-slate-500 border border-slate-200'

  if (val === 100) return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  return 'bg-red-100 text-red-800 border border-red-200'
}