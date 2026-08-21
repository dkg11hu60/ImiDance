'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Védett: ezt a párost nem engedjük kivenni / törölni, hogy az admin ki ne zárja magát.
const PROTECTED_ROLE = 'admin'
const PROTECTED_OBJECT = 'admin.users'

type Role = { key: string; label: string; sort: number }
type AppObject = { key: string; label: string; description?: string | null }

export function RoleAdmin() {
  const [roles, setRoles] = useState<Role[]>([])
  const [objects, setObjects] = useState<AppObject[]>([])
  // pipák halmaza: `${object_key}|${role_key}`
  const [checks, setChecks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Új szerep űrlap
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [rolesRes, objectsRes, matrixRes] = await Promise.all([
      supabase.from('roles').select('*').order('sort', { ascending: true }),
      supabase.from('app_objects').select('*').order('key', { ascending: true }),
      supabase.from('object_roles').select('*')
    ])

    setRoles(rolesRes.data || [])
    setObjects(objectsRes.data || [])

    const s = new Set<string>()
    ;(matrixRes.data || []).forEach((r: any) => s.add(`${r.object_key}|${r.role_key}`))
    setChecks(s)
    setLoading(false)
  }

  function isProtected(objectKey: string, roleKey: string) {
    return objectKey === PROTECTED_OBJECT && roleKey === PROTECTED_ROLE
  }

  async function toggleCell(objectKey: string, roleKey: string) {
    const cellKey = `${objectKey}|${roleKey}`
    const currentlyOn = checks.has(cellKey)

    // Véletlen-kizárás elleni védelem: az admin.users × admin pipát nem lehet kivenni
    if (currentlyOn && isProtected(objectKey, roleKey)) {
      setMsg({ type: 'err', text: 'Ez a jogosultság védett: az admin nem zárhatja ki magát a felhasználókezelésből.' })
      return
    }

    setBusy(cellKey)
    setMsg(null)

    if (currentlyOn) {
      const { error } = await supabase
        .from('object_roles')
        .delete()
        .eq('object_key', objectKey)
        .eq('role_key', roleKey)

      if (error) {
        setMsg({ type: 'err', text: 'A módosítás nem sikerült: ' + error.message })
        setBusy(null)
        return
      }
      setChecks(prev => {
        const next = new Set(prev)
        next.delete(cellKey)
        return next
      })
    } else {
      const { error } = await supabase
        .from('object_roles')
        .insert({ object_key: objectKey, role_key: roleKey })

      if (error) {
        setMsg({ type: 'err', text: 'A módosítás nem sikerült: ' + error.message })
        setBusy(null)
        return
      }
      setChecks(prev => new Set(prev).add(cellKey))
    }

    setBusy(null)
  }

  async function createRole() {
    const key = newKey.trim().toLowerCase()
    const label = newLabel.trim()
    setMsg(null)

    if (!key || !label) {
      setMsg({ type: 'err', text: 'A kulcs és a megnevezés is kötelező.' })
      return
    }
    if (!/^[a-z0-9_.]+$/.test(key)) {
      setMsg({ type: 'err', text: 'A kulcs csak kisbetűt, számot, pontot és aláhúzást tartalmazhat.' })
      return
    }
    if (roles.some(r => r.key === key)) {
      setMsg({ type: 'err', text: 'Ez a szerep-kulcs már létezik.' })
      return
    }

    const nextSort = roles.length ? Math.max(...roles.map(r => r.sort)) + 10 : 10
    const { error } = await supabase.from('roles').insert({ key, label, sort: nextSort })

    if (error) {
      setMsg({ type: 'err', text: 'A szerep létrehozása nem sikerült: ' + error.message })
      return
    }
    setNewKey('')
    setNewLabel('')
    setMsg({ type: 'ok', text: `Létrehozva: ${label}` })
    load()
  }

  async function renameRole(role: Role) {
    const label = prompt(`Új megnevezés a(z) "${role.key}" szerephez:`, role.label)
    if (label === null) return
    const trimmed = label.trim()
    if (!trimmed) return

    const { error } = await supabase.from('roles').update({ label: trimmed }).eq('key', role.key)
    if (error) {
      setMsg({ type: 'err', text: 'Az átnevezés nem sikerült: ' + error.message })
      return
    }
    setMsg({ type: 'ok', text: 'Átnevezve.' })
    load()
  }

  async function deleteRole(role: Role) {
    if (role.key === PROTECTED_ROLE) {
      setMsg({ type: 'err', text: 'Az admin szerep nem törölhető.' })
      return
    }
    if (!confirm(`Biztosan törlöd a(z) "${role.label}" szerepet? A hozzá tartozó pipák is törlődnek. Az ilyen szerepű felhasználók szerep nélkül maradnak.`)) {
      return
    }

    // A object_roles FK on delete cascade miatt a pipák maguktól törlődnek.
    const { error } = await supabase.from('roles').delete().eq('key', role.key)
    if (error) {
      setMsg({ type: 'err', text: 'A törlés nem sikerült: ' + error.message })
      return
    }
    setMsg({ type: 'ok', text: 'Törölve.' })
    load()
  }

  if (loading) return <div className="text-zinc-500 p-6">Szerepek betöltése...</div>

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-zinc-900 mb-1">Szerepek és jogosultságok</h3>
        <p className="text-xs text-zinc-500">
          A rács soronként egy objektum (funkció/link), oszloponként egy szerep. A pipa azt jelenti, hogy az adott szerep látja az objektumot. A védett cella (admin × Felhasználók kezelése) nem vehető ki.
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Mátrix */}
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 border-b">Objektum</th>
              {roles.map(role => (
                <th key={role.key} className="py-2 px-3 border-b text-center whitespace-nowrap">
                  <div className="font-semibold">{role.label}</div>
                  <div className="text-[10px] text-zinc-400 font-normal">{role.key}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {objects.map(obj => (
              <tr key={obj.key} className="border-b">
                <td className="py-2 pr-4">
                  <div className="font-medium text-zinc-800">{obj.label}</div>
                  <div className="text-[10px] text-zinc-400">{obj.key}</div>
                </td>
                {roles.map(role => {
                  const cellKey = `${obj.key}|${role.key}`
                  const on = checks.has(cellKey)
                  const locked = on && isProtected(obj.key, role.key)
                  return (
                    <td key={role.key} className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={busy === cellKey || locked}
                        title={locked ? 'Védett: nem vehető ki' : ''}
                        onChange={() => toggleCell(obj.key, role.key)}
                        className="w-4 h-4 accent-indigo-600 disabled:opacity-60"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Szerep-kezelés */}
      <div className="border-t pt-6 space-y-4">
        <h4 className="font-bold text-zinc-900">Szerepek kezelése</h4>

        <ul className="space-y-1">
          {roles.map(role => (
            <li key={role.key} className="flex items-center gap-3 text-sm">
              <span className="font-medium text-zinc-800">{role.label}</span>
              <span className="text-[10px] text-zinc-400">{role.key}</span>
              <button
                onClick={() => renameRole(role)}
                className="text-xs text-indigo-600 hover:underline"
              >
                Átnevez
              </button>
              {role.key !== PROTECTED_ROLE && (
                <button
                  onClick={() => deleteRole(role)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Töröl
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-3 pt-2">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Kulcs (gépi név)</label>
            <input
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="pl. assistant"
              className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Megnevezés</label>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="pl. Asszisztens"
              className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={createRole}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Új szerep
          </button>
        </div>
      </div>
    </div>
  )
}
