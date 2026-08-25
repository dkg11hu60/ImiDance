'use client'

import { useState } from 'react'

interface DancerAttendanceSummaryProps {
  attendancesData: any[]
  profilesData: any[]
  eventsData?: any[]
}

type SortField = 'name' | 'danceLevel' | 'registeredCount' | 'attendedCount' | 'paidCount' | 'status'
type SortDirection = 'asc' | 'desc'

export function DancerAttendanceSummary({
  attendancesData,
  profilesData,
  eventsData = []
}: DancerAttendanceSummaryProps) {
  const [search, setSearch] = useState('')
  const [onlyMismatches, setOnlyMismatches] = useState(false)
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null)

  // Sorba rendezési állapotok
  const [sortField, setSortField] = useState<SortField>('registeredCount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const eventMap = new Map(eventsData.map(e => [e.id, e]))

  const counts = new Map<
    string,
    {
      id: string
      name: string
      registeredCount: number
      attendedCount: number
      paidCount: number
      danceLevel: string
    }
  >()

  profilesData.forEach(p => {
    const name = p.full_name || (p.first_name && p.last_name ? `${p.last_name} ${p.first_name}` : p.name) || 'Névtelen'
    const level = p.dance_level || p.skill_level || p.level || '-'
    counts.set(p.id, {
      id: p.id,
      name,
      registeredCount: 0,
      attendedCount: 0,
      paidCount: 0,
      danceLevel: level
    })
  })

  attendancesData.forEach(a => {
    const profId = a.profile_id || a.user_id
    if (profId && counts.has(profId)) {
      const item = counts.get(profId)!
      item.registeredCount += 1
      if (a.attended) item.attendedCount += 1
      if (a.paid) item.paidCount += 1
    }
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'name' || field === 'danceLevel' ? 'asc' : 'desc')
    }
  }

  const sortedDancers = Array.from(counts.values())
    .filter(d => d.registeredCount > 0)
    .filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    .filter(d => (onlyMismatches ? d.attendedCount !== d.paidCount : true))
    .sort((a, b) => {
      let valA: number | string
      let valB: number | string

      if (sortField === 'status') {
        valA = a.attendedCount - a.paidCount
        valB = b.attendedCount - b.paidCount
      } else {
        valA = a[sortField]
        valB = b[sortField]
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB, 'hu')
        return sortDirection === 'asc' ? cmp : -cmp
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA
      }

      return 0
    })

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-zinc-300 ml-1">↕</span>
    return sortDirection === 'asc' ? <span className="text-indigo-600 ml-1">▲</span> : <span className="text-indigo-600 ml-1">▼</span>
  }

  const selectedDancer = selectedDancerId ? counts.get(selectedDancerId) : null
  const selectedDancerHistory = selectedDancerId
    ? attendancesData
        .filter(a => (a.profile_id || a.user_id) === selectedDancerId)
        .map(a => {
          const ev = eventMap.get(a.event_id || a.event)
          const rawDate = ev?.event_date || a.event_name || a.created_at
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
            title: ev?.title || a.event_name || 'Táncóra / Esemény',
            date: formattedDate,
            rawDate,
            attended: Boolean(a.attended),
            paid: Boolean(a.paid)
          }
        })
        .sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime())
    : []

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Összesített kimutatás táncosonként</h3>
          <p className="text-xs text-zinc-500">Kattints a fejlécekre a sorba rendezéshez, vagy a táncos nevére a részletes előzményekért</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
            <input
              type="checkbox"
              checked={onlyMismatches}
              onChange={(e) => setOnlyMismatches(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <span>Eltérés (Részvétel ≠ Fizetett)</span>
          </label>
          <input
            type="text"
            placeholder="Keresés név alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase select-none">
              <th onClick={() => handleSort('name')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors">
                Név {renderSortIcon('name')}
              </th>
              <th onClick={() => handleSort('danceLevel')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors">
                Szint {renderSortIcon('danceLevel')}
              </th>
              <th onClick={() => handleSort('registeredCount')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center">
                Jelentkezett {renderSortIcon('registeredCount')}
              </th>
              <th onClick={() => handleSort('attendedCount')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center">
                Részt vett {renderSortIcon('attendedCount')}
              </th>
              <th onClick={() => handleSort('paidCount')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center">
                Fizetett {renderSortIcon('paidCount')}
              </th>
              <th onClick={() => handleSort('status')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center">
                Státusz {renderSortIcon('status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedDancers.map((d) => {
              const hasMismatch = d.attendedCount !== d.paidCount
              return (
                <tr key={d.id} className={`hover:bg-zinc-50 transition-colors ${hasMismatch ? 'bg-amber-50/40' : ''}`}>
                  <td className="py-2.5 px-3 font-medium">
                    <button
                      onClick={() => setSelectedDancerId(d.id)}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline text-left font-semibold"
                    >
                      {d.name}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-500 text-xs">{d.danceLevel}</td>
                  <td className="py-2.5 px-3 text-center font-medium text-zinc-700">{d.registeredCount} alkalom</td>
                  <td className="py-2.5 px-3 text-center font-bold text-indigo-600">{d.attendedCount} alkalom</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{d.paidCount} alkalom</td>
                  <td className="py-2.5 px-3 text-center">
                    {hasMismatch ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                        {d.attendedCount > d.paidCount ? `Elmaradás (${d.attendedCount - d.paidCount})` : `Túlfizetés (${d.paidCount - d.attendedCount})`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                        Rendezve
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {sortedDancers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-400 italic">
                  Nincs megjeleníthető találat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Részletes modal nézet */}
      {selectedDancer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h4 className="text-lg font-bold text-zinc-900">{selectedDancer.name} részletes előzményei</h4>
                <p className="text-xs text-zinc-500">Szint: {selectedDancer.danceLevel}</p>
              </div>
              <button
                onClick={() => setSelectedDancerId(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1 text-xl font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="text-xs text-zinc-500 font-medium">Jelentkezett</div>
                  <div className="text-lg font-bold text-zinc-800">{selectedDancer.registeredCount}</div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="text-xs text-indigo-600 font-medium">Részt vett</div>
                  <div className="text-lg font-bold text-indigo-700">{selectedDancer.attendedCount}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-600 font-medium">Fizetett</div>
                  <div className="text-lg font-bold text-emerald-700">{selectedDancer.paidCount}</div>
                </div>
              </div>

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
                    {selectedDancerHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-zinc-900">{item.title}</div>
                          <div className="text-xs text-zinc-500">{item.date}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-emerald-600 font-bold">Igen</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.attended ? (
                            <span className="text-indigo-600 font-bold">Igen</span>
                          ) : (
                            <span className="text-zinc-400">Nem</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.paid ? (
                            <span className="text-emerald-600 font-bold">Igen</span>
                          ) : (
                            <span className="text-amber-600 font-bold">Nem</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 text-right">
              <button
                onClick={() => setSelectedDancerId(null)}
                className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
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