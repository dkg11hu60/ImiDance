'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const LEVELS = ['Haladó', 'SzuperH', 'ExtraH', 'Hobbi']
const ROLES = ['user', 'teacher', 'admin']

export function UserAdmin() {
  const [me, setMe] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setMe(data)
      }

      // Admin kivételével minden felhasználó
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .order('full_name', { nullsFirst: false })

      setRows((profs || []).map((p: any) => ({ ...p })))
      setLoading(false)
    }
    load()
  }, [])

  function patch(id: string, field: string, value: any) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))
  }

  async function save(row: any) {
    setSavingId(row.id)
    setMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: row.full_name,
        name: row.full_name,
        email: row.email,
        gender: row.gender,
        dance_level: row.dance_level || 'Haladó',
        role: row.role || 'user',
        can_view_detailed_stats: !!row.can_view_detailed_stats,
        is_active: row.is_active !== false
      })
      .eq('id', row.id)

    setSavingId(null)
    if (error) {
      setMsg({ id: row.id, type: 'err', text: 'Hiba: ' + error.message })
    } else {
      setMsg({ id: row.id, type: 'ok', text: 'Mentve' })
      // ha adminná vált, kiesik a szerkeszthető listából
      if (row.role === 'admin') setRows(prev => prev.filter(r => r.id !== row.id))
    }
  }

  if (loading) return <div className="text-zinc-500 p-6">Felhasználók betöltése...</div>
  if (me?.role !== 'admin') return <div className="text-red-600 p-6">Nincs jogosultság.</div>

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-zinc-900">Felhasználók kezelése</h3>
      <p className="text-xs text-zinc-500">
        Adminok nem jelennek meg és nem szerkeszthetők. A „Részl. stat." jelölő adja meg, hogy a felhasználó látja-e a részletes bontást. Az „Állapot" gombbal tiltható / engedélyezhető a hozzáférés.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-zinc-500">
              <th className="py-2 pr-3">Név</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Nem</th>
              <th className="py-2 pr-3">Szint</th>
              <th className="py-2 pr-3">Szerep</th>
              <th className="py-2 pr-3">Részl. stat.</th>
              <th className="py-2 pr-3">Állapot</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b align-top">
                <td className="py-2 pr-3">
                  <input
                    className="w-40 px-2 py-1 border border-zinc-300 rounded"
                    value={row.full_name || ''}
                    onChange={e => patch(row.id, 'full_name', e.target.value)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="email"
                    className="w-48 px-2 py-1 border border-zinc-300 rounded"
                    value={row.email || ''}
                    onChange={e => patch(row.id, 'email', e.target.value)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <select
                    className="px-2 py-1 border border-zinc-300 rounded bg-white"
                    value={row.gender || ''}
                    onChange={e => patch(row.id, 'gender', e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Fiú">Fiú</option>
                    <option value="Lány">Lány</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select
                    className="px-2 py-1 border border-zinc-300 rounded bg-white"
                    value={row.dance_level || 'Haladó'}
                    onChange={e => patch(row.id, 'dance_level', e.target.value)}
                  >
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select
                    className="px-2 py-1 border border-zinc-300 rounded bg-white"
                    value={row.role || 'user'}
                    onChange={e => patch(row.id, 'role', e.target.value)}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-3 text-center">
                  <input
                    type="checkbox"
                    checked={!!row.can_view_detailed_stats}
                    onChange={e => patch(row.id, 'can_view_detailed_stats', e.target.checked)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <button
                    onClick={() => patch(row.id, 'is_active', !(row.is_active !== false))}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      row.is_active !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {row.is_active !== false ? 'Aktív' : 'Kitiltva'}
                  </button>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <button
                    onClick={() => save(row)}
                    disabled={savingId === row.id}
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingId === row.id ? '...' : 'Mentés'}
                  </button>
                  {msg && msg.id === row.id && (
                    <span className={`ml-2 text-xs ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {msg.text}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}