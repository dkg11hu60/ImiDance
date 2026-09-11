'use client'

import { useState } from 'react'

interface DancerAttendanceSummaryProps {
  attendancesData: any[]
  profilesData: any[]
  eventsData?: any[]
}

type SortField = 'name' | 'danceLevel' | 'registeredCount' | 'attendedCount' | 'paidCount' | 'status' | 'attendanceRatio' | 'paymentRatio' | 'credibility'
type SortDirection = 'asc' | 'desc'

// Egy feltétel: melyik mérőszámra, milyen operátorral, milyen értékre.
// Aránymezők értéke %, darabmezők értéke db. A feltételek egymással ÉS-kapcsolatban.
type Metric =
  | 'attendanceRatio'
  | 'paymentRatio'
  | 'registeredCount'
  | 'attendedCount'
  | 'paidCount'
type CondOp = 'lt' | 'lte' | 'eq' | 'gte' | 'gt'

interface Condition {
  id: string
  metric: Metric
  op: CondOp
  value: number
}

const METRIC_LABEL: Record<Metric, string> = {
  attendanceRatio: 'Hiányzási arány',
  paymentRatio: 'Fizetési arány',
  registeredCount: 'Jelentkezések',
  attendedCount: 'Megjelenések',
  paidCount: 'Fizetések'
}

const isRatioMetric = (m: Metric) => m === 'attendanceRatio' || m === 'paymentRatio'

const OP_LABEL: Record<CondOp, string> = {
  lt: '<',
  lte: '≤',
  eq: '=',
  gte: '≥',
  gt: '>'
}

let uidCounter = 0
const uid = () => `${Date.now()}-${uidCounter++}`

export function DancerAttendanceSummary({
  attendancesData,
  profilesData,
  eventsData = []
}: DancerAttendanceSummaryProps) {
  const [search, setSearch] = useState('')
  const [onlyMismatches, setOnlyMismatches] = useState(false)
  const [onlyDelinquent, setOnlyDelinquent] = useState(false)
  const [onlyNoShow, setOnlyNoShow] = useState(false)
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null)

  // Sorba rendezési állapotok
  const [sortField, setSortField] = useState<SortField>('registeredCount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Szűrő-feltételek — mind ÉS-kapcsolatban
  const [conditions, setConditions] = useState<Condition[]>([])

  const eventMap = new Map(eventsData.map(e => [e.id, e]))

  const now = new Date()

  // Csak a múltbeli események ID-jai (ahogy a useStatisticsData-ban is)
  const pastEventIds = new Set(
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

  // Csak a befejeződött események aktív (nem lemondott) jelentkezéseit számítjuk be
  const pastAttendances = attendancesData.filter((a: any) => {
    const isPast = pastEventIds.has(a.event_id || a.event)
    const isActive = (a.status ?? '') !== 'cancelled'
    return isPast && isActive
  })

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

  pastAttendances.forEach(a => {
    const profId = a.profile_id || a.user_id
    if (profId && counts.has(profId)) {
      const item = counts.get(profId)!
      item.registeredCount += 1
      if (a.attended) item.attendedCount += 1
      if (a.paid) item.paidCount += 1
    }
  })

  // --- Mérőszámok ---
  // Hiányzási arány = hiányzott (jelentkezett - megjelent) / jelentkezett
  // Fizetési arány    = fizetett / megjelent  (0 megjelenésnél nincs értelmezhető arány → null)
  const absenceRatio = (d: { attendedCount: number; registeredCount: number }): number | null =>
    d.registeredCount > 0 ? Math.round(((d.registeredCount - d.attendedCount) / d.registeredCount) * 100) : null

  const paymentRatio = (d: { paidCount: number; attendedCount: number }): number | null =>
    d.attendedCount > 0 ? Math.round((d.paidCount / d.attendedCount) * 100) : null

  const metricValue = (
    d: { attendedCount: number; registeredCount: number; paidCount: number },
    m: Metric
  ): number | null => {
    switch (m) {
      case 'attendanceRatio': return absenceRatio(d)
      case 'paymentRatio': return paymentRatio(d)
      case 'registeredCount': return d.registeredCount
      case 'attendedCount': return d.attendedCount
      case 'paidCount': return d.paidCount
    }
  }

  const matchCondition = (
    d: { attendedCount: number; registeredCount: number; paidCount: number },
    c: Condition
  ): boolean => {
    const actual = metricValue(d, c.metric)
    if (actual === null) return false // értelmezhetetlen arány sosem passzol egy aktív feltételt
    switch (c.op) {
      case 'lt': return actual < c.value
      case 'lte': return actual <= c.value
      case 'eq': return actual === c.value
      case 'gte': return actual >= c.value
      case 'gt': return actual > c.value
    }
  }

  const passesFilters = (
    d: { attendedCount: number; registeredCount: number; paidCount: number }
  ): boolean => conditions.every(c => matchCondition(d, c))

  // --- Feltétel műveletek ---
  const addCondition = () => {
    setConditions(prev => [
      ...prev,
      { id: uid(), metric: 'attendanceRatio', op: 'gt', value: 50 }
    ])
  }

  const updateCondition = (cid: string, patch: Partial<Condition>) => {
    setConditions(prev => prev.map(c => (c.id === cid ? { ...c, ...patch } : c)))
  }

  const removeCondition = (cid: string) => {
    setConditions(prev => prev.filter(c => c.id !== cid))
  }

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
    .filter(d => (onlyDelinquent ? d.attendedCount > d.paidCount : true))
    .filter(d => (onlyNoShow ? d.registeredCount > d.attendedCount : true))
    .filter(d => passesFilters(d))
    .sort((a, b) => {
      let valA: number | string
      let valB: number | string

      if (sortField === 'status') {
        valA = a.attendedCount - a.paidCount
        valB = b.attendedCount - b.paidCount
      } else if (sortField === 'attendanceRatio') {
        const ratioA = absenceRatio(a) ?? -1
        const ratioB = absenceRatio(b) ?? -1
        if (ratioA === ratioB) {
          const missedA = a.registeredCount - a.attendedCount
          const missedB = b.registeredCount - b.attendedCount
          return sortDirection === 'asc' ? missedA - missedB : missedB - missedA
        }
        return sortDirection === 'asc' ? ratioA - ratioB : ratioB - ratioA
      } else if (sortField === 'paymentRatio') {
        const ratioA = paymentRatio(a) ?? -1
        const ratioB = paymentRatio(b) ?? -1
        return sortDirection === 'asc' ? ratioA - ratioB : ratioB - ratioA
      } else if (sortField === 'credibility') {
        const ratioA = 100 - (absenceRatio(a) ?? 0)
        const ratioB = 100 - (absenceRatio(b) ?? 0)
        return sortDirection === 'asc' ? ratioA - ratioB : ratioB - ratioA
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
    ? pastAttendances
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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Összesített kimutatás táncosonként</h3>
          <p className="text-xs text-zinc-500">Kattints a fejlécekre a sorba rendezéshez, vagy a táncos nevére a részletes előzményekért</p>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col items-start gap-1.5 w-full sm:w-auto">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors w-full">
              <input
                type="checkbox"
                checked={onlyMismatches}
                onChange={(e) => setOnlyMismatches(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Eltérés (Részvétel ≠ Fizetett)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-rose-900 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-rose-100 transition-colors w-full">
              <input
                type="checkbox"
                checked={onlyDelinquent}
                onChange={(e) => setOnlyDelinquent(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
              />
              <span>Hátralék / Elmaradás (Fizetett &lt; Részt vett)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-orange-900 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors w-full">
              <input
                type="checkbox"
                checked={onlyNoShow}
                onChange={(e) => setOnlyNoShow(e.target.checked)}
                className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4"
              />
              <span>Távolmaradás (Részt vett &lt; Jelentkezett)</span>
            </label>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Keresés név alapján..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-48"
            />
            {(search || onlyMismatches || onlyDelinquent || onlyNoShow || conditions.length > 0) && (
              <button
                onClick={() => {
                  setSearch('')
                  setOnlyMismatches(false)
                  setOnlyDelinquent(false)
                  setOnlyNoShow(false)
                  setConditions([])
                }}
                className="px-3 py-1 text-center text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap"
              >
                Szűrők törlése ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Szűrő-feltételek — mind ÉS */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Szűrők (mind ÉS)</span>
          <button
            onClick={addCondition}
            className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Feltétel
          </button>
        </div>

        {conditions.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">
            Nincs aktív szűrő. Adj hozzá feltételeket — a megadott feltételek együtt (ÉS) szűrnek.
          </p>
        ) : (
          <div className="space-y-2">
            {conditions.map((c, ci) => {
              const ratio = isRatioMetric(c.metric)
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-2">
                  {ci > 0 ? (
                    <span className="text-[10px] font-bold text-zinc-400 uppercase w-8">és</span>
                  ) : (
                    <span className="w-8" />
                  )}

                  <select
                    value={c.metric}
                    onChange={(e) => {
                      const metric = e.target.value as Metric
                      const nowRatio = isRatioMetric(metric)
                      const value = nowRatio ? Math.min(100, Math.max(0, c.value)) : Math.max(0, c.value)
                      updateCondition(c.id, { metric, value })
                    }}
                    className="px-2 py-1 text-xs font-semibold rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {(Object.keys(METRIC_LABEL) as Metric[]).map(m => (
                      <option key={m} value={m}>{METRIC_LABEL[m]}</option>
                    ))}
                  </select>

                  <select
                    value={c.op}
                    onChange={(e) => updateCondition(c.id, { op: e.target.value as CondOp })}
                    className="px-2 py-1 text-xs font-bold rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {(Object.keys(OP_LABEL) as CondOp[]).map(op => (
                      <option key={op} value={op}>{OP_LABEL[op]}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={ratio ? 100 : undefined}
                      value={c.value}
                      onChange={(e) => {
                        let v = Number(e.target.value)
                        if (Number.isNaN(v)) v = 0
                        v = ratio ? Math.min(100, Math.max(0, v)) : Math.max(0, v)
                        updateCondition(c.id, { value: v })
                      }}
                      className="w-20 px-2 py-1 text-xs rounded-lg border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-zinc-500 w-6">{ratio ? '%' : 'db'}</span>
                  </div>

                  <button
                    onClick={() => removeCondition(c.id)}
                    className="px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    aria-label="Feltétel törlése"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
            <p className="text-[11px] text-zinc-400">
              Hiányzási arány = hiányzott (jelentkezett - megjelent) / jelentkezett; fizetési arány = fizetett / megjelent. A darabmezők a jelentkezések / megjelenések / fizetések számát nézik.
            </p>
          </div>
        )}
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
              <th onClick={() => handleSort('attendanceRatio')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center">
                Hiányzás % {renderSortIcon('attendanceRatio')}
              </th>
              <th onClick={() => handleSort('paymentRatio')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center">
                Fiz. % {renderSortIcon('paymentRatio')}
              </th>
              <th onClick={() => handleSort('credibility')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center bg-indigo-50 text-indigo-900">
                Megbízhatóság {renderSortIcon('credibility')}
              </th>
              <th onClick={() => handleSort('status')} className="py-2.5 px-3 cursor-pointer hover:bg-zinc-50 transition-colors text-center">
                Státusz {renderSortIcon('status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedDancers.map((d) => {
              const hasMismatch = d.attendedCount !== d.paidCount
              const attR = absenceRatio(d)
              const payR = paymentRatio(d)
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
                  <td className="py-2.5 px-3 text-center tabular-nums text-zinc-700 font-semibold">
                    {attR === null ? '—' : `${d.registeredCount - d.attendedCount} / ${d.registeredCount} (${attR}%)`}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-zinc-700">
                    {payR === null ? '—' : `${payR}%`}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {attR === null ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold min-w-[55px] ${
                        (100 - attR) >= 80 ? 'bg-emerald-100 text-emerald-800' :
                        (100 - attR) >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {100 - attR}%
                      </span>
                    )}
                  </td>
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
                <td colSpan={8} className="py-6 text-center text-zinc-400 italic">
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

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="text-xs text-zinc-500 font-medium">Hiányzási arány</div>
                  <div className="text-lg font-bold text-zinc-800">
                    {absenceRatio(selectedDancer) === null ? '—' : `${absenceRatio(selectedDancer)}%`}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="text-xs text-zinc-500 font-medium">Fizetési arány</div>
                  <div className="text-lg font-bold text-zinc-800">
                    {paymentRatio(selectedDancer) === null ? '—' : `${paymentRatio(selectedDancer)}%`}
                  </div>
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
