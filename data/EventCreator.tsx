'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function EventCreator() {
  const [locations, setLocations] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [locationMap, setLocationMap] = useState<{ [key: string]: string }>({})

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [locationId, setLocationId] = useState('')
  const [accepted, setAccepted] = useState(false)

  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [locsRes, evsRes] = await Promise.all([
      supabase.from('locations').select('*').order('name'),
      supabase.from('events').select('*').order('event_date', { ascending: true })
    ])
    const locs = locsRes.data || []
    setLocations(locs)
    const lmap: { [key: string]: string } = {}
    locs.forEach((l: any) => { lmap[l.id] = l.name })
    setLocationMap(lmap)
    setEvents(evsRes.data || [])
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!accepted) return
    setCreating(true)
    setMsg(null)

    const title = `Táncóra (${date})`
    const { error } = await supabase.from('events').insert([{
      title,
      event_date: date,
      start_time: startTime,
      end_time: endTime,
      location_id: locationId,
      is_active: true
    }])

    setCreating(false)
    if (error) {
      setMsg({ type: 'err', text: 'Hiba az esemény létrehozásakor: ' + error.message })
    } else {
      setMsg({ type: 'ok', text: 'Esemény sikeresen létrehozva.' })
      setDate(''); setStartTime(''); setEndTime(''); setLocationId(''); setAccepted(false)
      loadAll()
    }
  }

  async function cancelEvent(ev: any) {
    if (!confirm(`Biztosan megszünteted ezt az eseményt: ${ev.title}? A jelentkezettek értesítést kapnak, és a jelentkezések NEM emelődnek át sehova.`)) {
      return
    }
    setCancelling(ev.id)
    setMsg(null)

    // 1. Az esemény lezárása (soft: az adat és a jelentkezések megmaradnak)
    const { error } = await supabase
      .from('events')
      .update({ is_active: false })
      .eq('id', ev.id)

    if (error) {
      setCancelling(null)
      setMsg({ type: 'err', text: 'A megszüntetés nem sikerült: ' + error.message })
      return
    }

    // 2. Jelentkezők értesítése emailben — a DB-változás már megtörtént, ez attól független.
    //    Ha az értesítés elhasal, a megszüntetés akkor is érvényes marad.
    let notifyOk = true
    try {
      const res = await fetch('/api/notify-event-cancelled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: ev.id })
      })
      if (!res.ok) notifyOk = false
    } catch {
      notifyOk = false
    }

    setCancelling(null)
    setMsg({
      type: 'ok',
      text: notifyOk
        ? 'Az esemény megszüntetve, a jelentkezettek értesítve.'
        : 'Az esemény megszüntetve. Az email-értesítés viszont nem ment ki — ellenőrizd az értesítő szolgáltatást.'
    })
    loadAll()
  }

  const liveEvents = events.filter(e => e.is_active !== false)
  const cancelledEvents = events.filter(e => e.is_active === false)

  return (
    <div className="space-y-8">
      {/* Figyelmeztetés: az események nem módosíthatók */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">Fontos tudnivaló az eseményekről</p>
        <p>
          Eseményt nem lehet módosítani, kizárólag megszüntetni és újat készíteni.
          Ha megszüntetsz egy eseményt, az arra jelentkezettek erről értesítést kapnak emailben.
          Az új eseménybe a jelentkezéseket a rendszer NEM emeli át.
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Új esemény */}
      <form onSubmit={handleCreateEvent} className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
        <h2 className="text-xl font-bold">Új esemény felvétele</h2>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <div className="flex gap-2">
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <select
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Válassz helyszínt...</option>
          {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
        </select>

        <label className="flex items-start gap-2 text-sm text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-indigo-600"
          />
          <span>
            Megértettem, hogy az eseményt később nem módosíthatom, csak megszüntethetem és újat hozhatok létre;
            megszüntetéskor a jelentkezettek emailben értesülnek; és a jelentkezéseket a rendszer nem emeli át az új eseménybe.
          </span>
        </label>

        <button
          type="submit"
          disabled={!accepted || creating}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
        >
          {creating ? 'Létrehozás...' : 'Esemény létrehozása'}
        </button>
      </form>

      {/* Élő események */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-zinc-900">Aktív események</h3>
        {liveEvents.length === 0 && (
          <p className="text-sm text-zinc-500">Nincs aktív esemény.</p>
        )}
        {liveEvents.map(ev => (
          <div key={ev.id} className="p-4 border border-zinc-200 rounded-xl bg-white flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-zinc-900">{ev.title}</div>
              <div className="text-xs text-zinc-500">
                {ev.event_date} · {ev.start_time?.slice(0, 5)}–{ev.end_time?.slice(0, 5)} · {locationMap[ev.location_id] || 'Helyszín nélkül'}
              </div>
            </div>
            <button
              onClick={() => cancelEvent(ev)}
              disabled={cancelling === ev.id}
              className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 whitespace-nowrap"
            >
              {cancelling === ev.id ? 'Megszüntetés...' : 'Megszüntet'}
            </button>
          </div>
        ))}
      </div>

      {/* Megszűnt események */}
      {cancelledEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-zinc-400">Megszűnt események</h3>
          {cancelledEvents.map(ev => (
            <div key={ev.id} className="p-4 border border-zinc-100 rounded-xl bg-zinc-50 flex items-center justify-between gap-4 opacity-70">
              <div>
                <div className="font-semibold text-zinc-500 line-through">{ev.title}</div>
                <div className="text-xs text-zinc-400">
                  {ev.event_date} · {locationMap[ev.location_id] || 'Helyszín nélkül'}
                </div>
              </div>
              <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Megszűnt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
