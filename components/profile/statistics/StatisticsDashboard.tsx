'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface DanceStat {
  datum: string
  idopont: string
  f: number
  l: number
  p: number
  h: number
  sz: number
  ex: number
  hobbi: number
  Össz: number
}

interface Attendee {
  nev: string
  nem: string
  par_neve: string | null
  tudasszint: string | null
}

export default function StatisticDashboard() {
  const [stats, setStats] = useState<DanceStat[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [isAuthorized, setIsAuthorized] = useState<boolean>(false)
  const [selectedRow, setSelectedRow] = useState<DanceStat | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loadingAttendees, setLoadingAttendees] = useState<boolean>(false)

  // Fő táblázat rendezési állapotok
  const [sortField, setSortField] = useState<keyof DanceStat>('datum')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Résztvevői lista rendezési állapotok
  const [attendeeSortField, setAttendeeSortField] = useState<keyof Attendee>('nev')
  const [attendeeSortDirection, setAttendeeSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role_key')
            .eq('user_id', user.id)

          const roleKeys = rolesData?.map(r => r.role_key) || []
          
          const isTeacherOrAdmin = roleKeys.some(key => 
            ['admin', 'teacher', 'oktato'].includes(key) || 
            key.includes('admin') || 
            key.includes('teacher')
          )

          setIsAuthorized(isTeacherOrAdmin)
        }

        const { data, error } = await supabase.rpc('get_dance_event_stats')
        if (error) throw error
        setStats(data || [])

      } catch (err: any) {
        setError(err.message || 'Hiba történt az adatok lekérdezése közben.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  const handleRowClick = async (row: DanceStat) => {
    if (!isAuthorized) return

    setSelectedRow(row)
    setLoadingAttendees(true)
    setAttendees([])
    setAttendeeSortField('nev')
    setAttendeeSortDirection('asc')

    try {
      const { data, error } = await supabase.rpc('get_event_attendees', {
        p_datum: row.datum,
        p_idopont: row.idopont
      })

      if (error) throw error
      setAttendees(data || [])
    } catch (err: any) {
      console.error('Hiba a jelentkezők betöltésekor:', err.message)
    } finally {
      setLoadingAttendees(false)
    }
  }

  // Fő táblázat rendezése
  const handleSort = (field: keyof DanceStat) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedStats = [...stats].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal, 'hu') 
        : bVal.localeCompare(aVal, 'hu')
    } else {
      const numA = Number(aVal) || 0
      const numB = Number(bVal) || 0
      return sortDirection === 'asc' ? numA - numB : numB - numA
    }
  })

  // Résztvevők rendezése
  const handleAttendeeSort = (field: keyof Attendee) => {
    if (attendeeSortField === field) {
      setAttendeeSortDirection(attendeeSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setAttendeeSortField(field)
      setAttendeeSortDirection('asc')
    }
  }

  const sortedAttendees = [...attendees].sort((a, b) => {
    const aVal = a[attendeeSortField] || ''
    const bVal = b[attendeeSortField] || ''
    return attendeeSortDirection === 'asc'
      ? aVal.localeCompare(bVal, 'hu')
      : bVal.localeCompare(aVal, 'hu')
  })

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
        Statisztikai adatok betöltése...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
        Hiba: {error}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Táncesemények jelentkezési statisztikája
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAuthorized 
              ? 'Kattints bármelyik sorra a részletes résztvevői lista megtekintéséhez.' 
              : 'Részletes kimutatás események, nemek, párok és tudásszintek szerint.'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto shadow-xl rounded-2xl border border-slate-200 bg-white max-h-[75vh] overflow-y-auto relative">
        <table className="min-w-full divide-y divide-slate-200 text-sm border-collapse">
          <thead className="bg-slate-900 text-slate-100 text-xs tracking-wider sticky top-0 z-20 shadow-sm">
            <tr>
              <th 
                onClick={() => handleSort('datum')} 
                className="px-4 py-3.5 text-left font-semibold bg-slate-900 cursor-pointer hover:bg-slate-800 select-none transition-colors"
              >
                Dátum {sortField === 'datum' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('idopont')} 
                className="px-4 py-3.5 text-left font-semibold bg-slate-900 cursor-pointer hover:bg-slate-800 select-none transition-colors"
              >
                Időpont {sortField === 'idopont' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('f')} 
                className="px-4 py-3.5 text-center font-semibold bg-blue-950 text-blue-200 cursor-pointer hover:bg-blue-900 select-none transition-colors" 
                title="Szóló fiúk"
              >
                Fiú {sortField === 'f' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('l')} 
                className="px-4 py-3.5 text-center font-semibold bg-rose-950 text-rose-200 cursor-pointer hover:bg-rose-900 select-none transition-colors" 
                title="Szóló lányok"
              >
                Lány {sortField === 'l' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('p')} 
                className="px-4 py-3.5 text-center font-semibold bg-indigo-950 text-indigo-200 cursor-pointer hover:bg-indigo-900 select-none transition-colors" 
                title="Párok száma"
              >
                Pár {sortField === 'p' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('h')} 
                className="px-4 py-3.5 text-center font-semibold bg-slate-900 cursor-pointer hover:bg-slate-800 select-none transition-colors" 
                title="Haladó"
              >
                H {sortField === 'h' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('sz')} 
                className="px-4 py-3.5 text-center font-semibold bg-slate-900 cursor-pointer hover:bg-slate-800 select-none transition-colors" 
                title="SzuperH / Szalon"
              >
                Sz {sortField === 'sz' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('ex')} 
                className="px-4 py-3.5 text-center font-semibold bg-slate-900 cursor-pointer hover:bg-slate-800 select-none transition-colors" 
                title="ExtraH"
              >
                Ex {sortField === 'ex' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('hobbi')} 
                className="px-4 py-3.5 text-center font-semibold bg-slate-900 cursor-pointer hover:bg-slate-800 select-none transition-colors" 
                title="Hobbi"
              >
                Hobbi {sortField === 'hobbi' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th 
                onClick={() => handleSort('Össz')} 
                className="px-4 py-3.5 text-center font-semibold bg-slate-800 text-amber-300 cursor-pointer hover:bg-slate-700 select-none transition-colors" 
                title="Összesen"
              >
                Összesen {sortField === 'Össz' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-700">
            {sortedStats.map((row, index) => {
              const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
              const clickableClass = isAuthorized ? 'cursor-pointer hover:bg-indigo-100/70' : 'hover:bg-indigo-50/50'

              return (
                <tr 
                  key={index} 
                  className={`${rowBg} ${clickableClass} transition-colors`}
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                    {row.datum}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {row.idopont}
                  </td>
                  <td className="px-4 py-3 text-center font-medium bg-blue-50/30 text-blue-900">
                    {row.f}
                  </td>
                  <td className="px-4 py-3 text-center font-medium bg-rose-50/30 text-rose-900">
                    {row.l}
                  </td>
                  <td className="px-4 py-3 text-center font-bold bg-indigo-50/30 text-indigo-700">
                    {row.p}
                  </td>
                  <td className="px-4 py-3 text-center">{row.h}</td>
                  <td className="px-4 py-3 text-center">{row.sz}</td>
                  <td className="px-4 py-3 text-center">{row.ex}</td>
                  <td className="px-4 py-3 text-center">{row.hobbi}</td>
                  <td className="px-4 py-3 text-center font-extrabold bg-slate-100 text-slate-900 shadow-inner">
                    {row.Össz}
                  </td>
                </tr>
              )
            })}

            {sortedStats.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-400 italic">
                  Nincsenek megjeleníthető adatok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold">Jelentkezők listája</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Dátum: <span className="font-semibold text-white">{selectedRow.datum}</span> | Időpont: <span className="font-semibold text-white">{selectedRow.idopont}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedRow(null)}
                className="text-slate-400 hover:text-white text-xl font-bold px-2 py-1 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingAttendees ? (
                <div className="py-12 text-center text-slate-500 font-medium animate-pulse">
                  Jelentkezők betöltése...
                </div>
              ) : sortedAttendees.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200 text-sm border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-xs tracking-wider sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th 
                        onClick={() => handleAttendeeSort('nev')}
                        className="px-4 py-3 text-left font-semibold bg-slate-100 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                      >
                        Név {attendeeSortField === 'nev' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th 
                        onClick={() => handleAttendeeSort('nem')}
                        className="px-4 py-3 text-center font-semibold bg-slate-100 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                      >
                        Nem {attendeeSortField === 'nem' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th 
                        onClick={() => handleAttendeeSort('par_neve')}
                        className="px-4 py-3 text-left font-semibold bg-slate-100 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                      >
                        Pár neve {attendeeSortField === 'par_neve' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th 
                        onClick={() => handleAttendeeSort('tudasszint')}
                        className="px-4 py-3 text-center font-semibold bg-slate-100 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                      >
                        Tudásszint {attendeeSortField === 'tudasszint' && (attendeeSortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {sortedAttendees.map((att, i) => (
                      <tr key={i} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{att.nev}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            att.nem === 'F' || att.nem === 'Fiú' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {att.nem || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {att.par_neve || <span className="text-slate-400 italic">Nincs párja</span>}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800">
                          {att.tudasszint || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-400 italic">
                  Ehhez az időponthoz nincsenek jelentkezők.
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedRow(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Bezárás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}