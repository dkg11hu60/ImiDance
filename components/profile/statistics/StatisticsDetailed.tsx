'use client'

// Csak a névsor-panel. A Dashboard kizárólag akkor rendereli, ha a szerep látja a
// stats.detailed objektumot, és van kiválasztott alkalom.
export function StatisticsDetailed({
  selectedEvent,
  onClose,
}: {
  selectedEvent: any | null
  onClose: () => void
}) {
  if (!selectedEvent) return null

  return (
    <div className="p-4 bg-zinc-50 rounded-lg border border-indigo-100 shadow-sm mt-4">
      <h4 className="font-bold text-indigo-800 mb-4">
        Részletek: {selectedEvent.date} ({selectedEvent.location})
      </h4>

      {/* Tudásszint eloszlás — kizárólag itt, alkalmanként */}
      <div className="mb-4 p-3 bg-white rounded border border-indigo-50 shadow-inner">
        <h5 className="text-[10px] uppercase font-bold text-indigo-400 mb-2">Tudásszint eloszlás</h5>
        <div className="flex gap-4">
          {Object.entries(selectedEvent.skillDistribution || {}).map(([level, count]) => (
            <div key={level}>
              <span className="block text-xs font-bold text-indigo-900">{count as number}</span>
              <span className="block text-[10px] text-zinc-500">{level}</span>
            </div>
          ))}
        </div>
      </div>

      <h5 className="text-[10px] uppercase font-bold text-indigo-400 mb-2">Résztvevők</h5>
      <ul className="list-disc pl-4 space-y-1">
        {(selectedEvent.attendees || []).map((a: any, idx: number) => (
          <li key={idx} className="text-sm">
            {a.name} <span className="text-zinc-400 italic text-[10px]">({a.skill})</span>
          </li>
        ))}
      </ul>

      <button
        className="mt-4 text-xs text-indigo-600 underline"
        onClick={onClose}
      >
        Bezárás
      </button>
    </div>
  )
}