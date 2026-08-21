'use client'

export function StatisticsOverview({
  stats,
  summary,
  data = [],
  visibleObjects,
  onRowSelect,
}: {
  stats: any[]
  summary?: any
  data?: any[]
  visibleObjects: Set<string>
  onRowSelect?: (row: any) => void
}) {
  const canOpenDetailed = visibleObjects.has('stats.detailed')

  const totalEvents = summary?.totalEvents ?? stats.length
  const totalAtt = summary?.totalAttendances ?? 0
  const f = summary?.f ?? 0
  const l = summary?.l ?? 0

  const pct = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0

  // Helykímélő létszám: F/L/P/Összes egy cellában. Összes = egyedi résztvevők (attendees.length).
  const formatCounts = (row: any): string => {
    const total = Array.isArray(row.attendees) ? row.attendees.length : 0
    if (total === 0) return '—/—/—/—'
    return `${row.fCount ?? 0}/${row.lCount ?? 0}/${row.pairs ?? 0}/${total}`
  }

  function handleRowClick(row: any) {
    if (!canOpenDetailed) return
    onRowSelect?.(row)
  }

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Összesített statisztika</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-100 rounded-lg">
          <p className="text-sm text-zinc-600">Nyitott események száma:</p>
          <p className="text-2xl font-bold">{totalEvents}</p>
        </div>

        <div className="p-4 bg-zinc-100 rounded-lg">
          <p className="text-sm text-zinc-600">Összes jelentkezés</p>
          <p className="text-2xl font-bold">{totalAtt}</p>
        </div>

        <div className="p-4 bg-zinc-100 rounded-lg">
          <p className="text-sm text-zinc-600">Fiú / Lány</p>
          <p className="text-2xl font-bold">{f} / {l}</p>
          <p className="text-[11px] text-zinc-500">{pct(f, f + l)}% / {pct(l, f + l)}%</p>
        </div>

        <div className="p-4 bg-zinc-100 rounded-lg">
          <p className="text-sm text-zinc-600">Átlag / alkalom</p>
          <p className="text-2xl font-bold">
            {totalEvents > 0 ? Math.round(totalAtt / totalEvents) : 0}
          </p>
        </div>
      </div>

      {/* Mindenki által látható alkalom-táblázat (névsor nélkül) */}
      <div className="space-y-2">
        <h4 className="font-bold text-base">Alkalmak</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left">Dátum</th>
              <th className="text-left">F/L/P/Összes</th>
              <th className="text-left">Helyszín</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={`border-b transition-colors ${
                  canOpenDetailed ? 'hover:bg-indigo-50 cursor-pointer' : ''
                }`}
                onClick={() => handleRowClick(row)}
              >
                <td className={`py-2 ${canOpenDetailed ? 'underline text-indigo-700' : 'text-zinc-700'}`}>
                  {row.date}
                </td>
                <td className="py-2 tabular-nums whitespace-nowrap text-zinc-700">
                  {formatCounts(row)}
                </td>
                <td className="py-2">{row.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}