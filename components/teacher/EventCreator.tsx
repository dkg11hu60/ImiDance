'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function EventCreator() {
  const [locations, setLocations] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [locationId, setLocationId] = useState('')

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('locations').select('*')
      if (data) setLocations(data)
    }
    fetchLocations()
  }, [])

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('events').insert([
      {
        title: title.trim() || null,
        event_date: date,
        start_time: startTime,
        end_time: endTime,
        location_id: locationId
      }
    ])

    if (error) alert('Hiba az esemény létrehozásakor: ' + error.message)
    else {
      alert('Esemény sikeresen létrehozva!')
      setTitle(''); setDate(''); setStartTime(''); setEndTime(''); setLocationId('')
    }
  }

  return (
    <form onSubmit={handleCreateEvent} className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl border border-zinc-200 space-y-4">
      <h2 className="text-xl font-bold">Új esemény felvétele</h2>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Megnevezés (pl. Tango és Samba) – opcionális"
        className="w-full p-2 border rounded"
      />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded" required />
      <div className="flex gap-2">
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded" required />
        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded" required />
      </div>
      <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full p-2 border rounded" required>
        <option value="">Válassz helyszínt...</option>
        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
      </select>
      <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg">Esemény létrehozása</button>
    </form>
  )
}