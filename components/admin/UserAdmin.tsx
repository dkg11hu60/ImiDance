'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export function UserAdmin() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [resetStatus, setResetStatus] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setMyId(user?.id ?? null)

    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('roles').select('*').order('sort', { ascending: true })
    ])
    if (profilesRes.data) setProfiles(profilesRes.data)
    if (rolesRes.data) setRoles(rolesRes.data)
    setLoading(false)
  }

  async function updateProfile(id: string, field: string, value: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', id)

    if (error) alert('Hiba: ' + error.message)
    else loadData()
  }

  async function toggleUserActive(id: string, currentActive: boolean, userName: string) {
    if (currentActive) {
      const confirmMsg =
        `Biztosan le akarod tiltani a következőt: ${userName}?\n\n` +
        `A tiltás következményei:\n` +
        `• A felhasználó azonnal kizárásra kerül a rendszerből.\n` +
        `• Új bejelentkezésre nem lesz lehetősége.\n` +
        `• A korábbi adatai és jelenléti statisztikái megmaradnak.\n` +
        `• A művelet bármikor visszavonható (Aktiválás).`

      if (!confirm(confirmMsg)) return
    } else {
      const confirmMsg = `Biztosan újra aktiválod a következőt: ${userName}? Ezzel a felhasználó ismét be tud majd lépni.`
      if (!confirm(confirmMsg)) return
    }

    try {
      const res = await fetch('/api/set-user-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, active: !currentActive }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Hiba történt a státusz módosításakor.')
      }

      loadData()
    } catch (err: any) {
      alert('Hiba a tiltás során: ' + err.message)
    }
  }

  async function sendPasswordReset(emailsToSend: string[]) {
    if (emailsToSend.length === 0) {
      alert('Nincs küldhető e-mail cím megadva.')
      return
    }

    const confirmMsg = emailsToSend.length === 1 
      ? `Biztosan kiküldöd a jelszó-visszaállító linket erre a címre: ${emailsToSend[0]}?`
      : `Biztosan kiküldöd a jelszó-visszaállító linket mind a ${emailsToSend.length} felhasználónak?`

    if (!confirm(confirmMsg)) return

    setResetting(true)
    setResetStatus('Mailing folyamatban...')

    try {
      const res = await fetch('/api/reset-password-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailsToSend }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Hiba történt a levelek küldése során.')
      }

      setResetStatus(
        `Sikeresen kiküldve: ${data.summary.successCount} / ${data.summary.total}. (Hibalista: ${data.summary.failCount})`
      )
    } catch (err: any) {
      setResetStatus(`Hiba: ${err.message}`)
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div>Adatok betöltése...</div>

  const allEmails = profiles.map(p => p.email).filter((email): email is string => Boolean(email))

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 overflow-x-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Felhasználók adminisztrációja</h2>
        <button
          onClick={() => sendPasswordReset(allEmails)}
          disabled={resetting || allEmails.length === 0}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {resetting ? 'Küldés...' : `Jelszó-visszaállítás mindenkinek (${allEmails.length})`}
        </button>
      </div>

      {resetStatus && (
        <div className="p-3 bg-zinc-100 text-zinc-800 rounded-xl text-xs font-medium">
          {resetStatus}
        </div>
      )}

      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="pb-3">Név</th>
            <th className="pb-3">E-mail</th>
            <th className="pb-3">Szint</th>
            <th className="pb-3">Szerep</th>
            <th className="pb-3 text-right">Akciók</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {profiles.map(p => {
            const isSelf = p.id === myId
            const isActive = p.is_active ?? true
            const displayName = p.full_name || p.name || 'Névtelen'

            return (
              <tr key={p.id} className={!isActive ? 'bg-zinc-50 opacity-75' : ''}>
                <td className="py-3 font-medium whitespace-nowrap">
                  {displayName}
                  {!isActive && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-normal">
                      Inaktív
                    </span>
                  )}
                </td>
                <td className="py-3 text-zinc-500 whitespace-nowrap">{p.email || '-'}</td>
                <td className="py-3 whitespace-nowrap">
                  <select
                    value={p.dance_level || 'Haladó'}
                    onChange={(e) => updateProfile(p.id, 'dance_level', e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    {['Haladó', 'SzuperH', 'ExtraH', 'Hobbi'].map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 whitespace-nowrap">
                  {isSelf ? (
                    <span className="px-2 py-1 text-zinc-500 italic">
                      {roles.find(r => r.key === p.role)?.label || p.role || 'admin'} (te)
                    </span>
                  ) : (
                    <select
                      value={p.role || 'user'}
                      onChange={(e) => updateProfile(p.id, 'role', e.target.value)}
                      className="border rounded px-2 py-1"
                    >
                      {roles.map(r => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    {p.email && (
                      <button
                        onClick={() => sendPasswordReset([p.email])}
                        disabled={resetting}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 whitespace-nowrap"
                      >
                        Reset link
                      </button>
                    )}

                    {!isSelf && (
                      <div className="border-l border-zinc-200 pl-3 flex items-center">
                        <button
                          onClick={() => toggleUserActive(p.id, isActive, displayName)}
                          className={`text-xs font-medium px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                            !isActive
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {!isActive ? 'Aktiválás' : 'Tiltás'}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}