'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AttendanceRecord {
  id: string
  event_id: string
  profile_id: string
  attended: boolean
  paid: boolean
  status?: string
  profiles: {
    full_name?: string
    first_name?: string
    last_name?: string
    name?: string
  }
}

interface AttendanceTrackerProps {
  eventId: string
}

export function AttendanceTracker({ eventId }: AttendanceTrackerProps) {
  const [registrations, setRegistrations] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchEventRegistrations()
  }, [eventId])

  async function fetchEventRegistrations() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('attendances')
        .select(`
          id,
          event_id,
          profile_id,
          attended,
          paid,
          status,
          profiles:profile_id (
            full_name,
            first_name,
            last_name,
            name
          )
        `)
        .eq('event_id', eventId)

      if (error) {
        console.error('Error fetching attendances:', error.message)
      } else if (data) {
        setRegistrations(data as unknown as AttendanceRecord[])
      }
    } catch (err) {
      console.error('Unexpected error loading attendance list:', err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleStatus(attendanceId: string, field: 'attended' | 'paid', currentValue: boolean) {
    setUpdatingId(attendanceId)
    const newValue = !currentValue

    setRegistrations((prev) =>
      prev.map((item) =>
        item.id === attendanceId ? { ...item, [field]: newValue } : item
      )
    )

    try {
      const { error } = await supabase
        .from('attendances')
        .update({ [field]: newValue })
        .eq('id', attendanceId)

      if (error) {
        console.error(`Error updating ${field}:`, error.message)
        setRegistrations((prev) =>
          prev.map((item) =>
            item.id === attendanceId ? { ...item, [field]: currentValue } : item
          )
        )
      }
    } catch (err) {
      console.error(`Unexpected error during ${field} update:`, err)
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-zinc-500">Regisztráltak betöltése...</div>
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-zinc-900">Regisztráltak ellenőrzése</h3>

      {registrations.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">Még senki nem regisztrált erre az eseményre.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase">
                <th className="py-3 px-2">Név</th>
                <th className="py-3 px-2 text-center">Megjelent</th>
                <th className="py-3 px-2 text-center">Fizetett</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {registrations.map((reg) => {
                const profile = reg.profiles
                const userName = profile?.full_name || 
                  (profile?.first_name && profile?.last_name ? `${profile.last_name} ${profile.first_name}` : profile?.name) || 
                  'Névtelen'

                return (
                  <tr key={reg.id} className="hover:bg-zinc-50">
                    <td className="py-3 px-2 font-medium text-zinc-900">{userName}</td>
                    
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={reg.attended || false}
                        disabled={updatingId === reg.id}
                        onChange={() => toggleStatus(reg.id, 'attended', reg.attended)}
                        className="w-5 h-5 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={reg.paid || false}
                        disabled={updatingId === reg.id}
                        onChange={() => toggleStatus(reg.id, 'paid', reg.paid)}
                        className="w-5 h-5 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}