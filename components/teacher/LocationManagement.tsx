'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LocationItem {
  id: string
  name: string
  address?: string | null
  maps_url?: string | null
}

export function LocationManagement() {
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showHelper, setShowHelper] = useState(false)

  const fetchLocations = async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setLocations(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  const handleOpenCreate = () => {
    setEditingId(null)
    setName('')
    setAddress('')
    setMapsUrl('')
    setShowHelper(false)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (loc: LocationItem) => {
    setEditingId(loc.id)
    setName(loc.name || '')
    setAddress(loc.address || '')
    setMapsUrl(loc.maps_url || '')
    setShowHelper(false)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)

    try {
      const endpoint = editingId ? '/api/update-location' : '/api/save-location'
      const payload = editingId
        ? { id: editingId, name, address, maps_url: mapsUrl }
        : { name, address, maps_url: mapsUrl }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Hiba történt a mentés során.')
      }

      setName('')
      setAddress('')
      setMapsUrl('')
      setEditingId(null)
      setIsModalOpen(false)
      setShowHelper(false)
      fetchLocations()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      alert(`Hiba a művelet során: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-zinc-500">Helyszínek betöltése...[cite: 2]</div>
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
        Hiba a helyszínek betöltésekor: {error}[cite: 2]
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Helyszínek</h2>
          <p className="text-sm text-zinc-500">
            A táncórák és események helyszíneinek kezelése.[cite: 2]
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
        >
          + Új helyszín felvétele[cite: 2]
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.length === 0 ? (
          <p className="text-sm text-zinc-500 italic col-span-2">
            Még nincs egyetlen helyszín sem rögzítve.[cite: 2]
          </p>
        ) : (
          locations.map((location) => (
            <div
              key={location.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900">
                    {location.name}
                  </h3>
                  <button
                    onClick={() => handleOpenEdit(location)}
                    className="text-xs text-zinc-600 hover:text-indigo-600 font-medium px-2 py-1 rounded bg-zinc-100 hover:bg-indigo-50 transition-colors"
                  >
                    Szerkesztés
                  </button>
                </div>
                {location.address && (
                  <p className="text-sm text-zinc-600">{location.address}</p>
                )}
              </div>

              {location.maps_url && (
                <div>
                  <a
                    href={location.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                  >
                    Megnyitás Google Térképen &rarr;[cite: 2]
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-zinc-200">
            <div className="border-b border-zinc-100 pb-3">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingId ? 'Helyszín szerkesztése' : 'Új helyszín felvétele'}[cite: 2]
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Helyszín neve *[cite: 2]
                </label>
                <input
                  type="text"
                  required
                  placeholder="pl. Roxy Stúdió"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Cím[cite: 2]
                </label>
                <input
                  type="text"
                  placeholder="pl. 1085 Budapest, Táncsics Mihály u. 4."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Google Maps URL[cite: 2]
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHelper((v) => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                  >
                    {showHelper ? 'Súgó elrejtése' : 'Hogyan kell kimásolni?'}[cite: 2]
                  </button>
                </div>
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900"
                />

                {/* Súgó panel */}
                {showHelper && (
                  <div className="mt-2 p-3 bg-indigo-50/80 border border-indigo-100 rounded-lg text-xs space-y-2 text-zinc-700">
                    <p className="font-semibold text-indigo-900">
                      Útmutató a hivatkozás kimásolásához:[cite: 2]
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-zinc-600">
                      <li>
                        Nyisd meg a{' '}
                        <a
                          href="https://maps.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 font-medium underline"
                        >
                          Google Térképet[cite: 2]
                        </a>
                        .
                      </li>
                      <li>Keresd meg és kattints a kiválasztott helyszínre.[cite: 2]</li>
                      <li>
                        Kattints a **Megosztás** (vagy *Share*) gombra.[cite: 2]
                      </li>
                      <li>
                        A felugró ablakban kattints a **Link másolása** (vagy *Copy link*) gombra.[cite: 2]
                      </li>
                      <li>Illeszd be a kimásolt hivatkozást ide a fenti mezőbe![cite: 2]</li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setShowHelper(false)
                    setEditingId(null)
                  }}
                  disabled={submitting}
                  className="px-4 py-2 text-zinc-600 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  Mégse[cite: 2]
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-white bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Mentés...' : editingId ? 'Módosítás mentése' : 'Helyszín mentése'}[cite: 2]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}