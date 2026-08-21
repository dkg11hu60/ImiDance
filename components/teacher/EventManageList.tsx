'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface EventItem {
  id: string
  event_date: string
  start_time?: string
  end_time?: string
  location_id: string
  title?: string
  is_active?: boolean
}

interface LocationItem {
  id: string
  name: string
}

interface Recipient {
  name: string
  email: string
}

interface NoEmailMember {
  name: string
}

interface CancellationResult {
  error?: string
  sent?: Array<{ name: string; email: string }>
  skipped_no_email?: Array<{ name: string }>
  failed?: Array<{ name: string; email: string; error: string }>
  warning?: string
}

const isValidEmail = (email?: string | null): boolean => {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export function EventManageList() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [locationMap, setLocationMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState<boolean>(true)

  const [modalEvent, setModalEvent] = useState<EventItem | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [noEmail, setNoEmail] = useState<NoEmailMember[]>([])
  const [subject, setSubject] = useState<string>('')
  const [body, setBody] = useState<string>('')
  const [ack, setAck] = useState<boolean>(false)
  const [prepping, setPrepping] = useState<boolean>(false)
  const [sending, setSending] = useState<boolean>(false)
  const [result, setResult] = useState<CancellationResult | null>(null)

  useEffect(() => {
    async function loadData() {
      const [evRes, locRes] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('locations').select('*'),
      ])

      setEvents((evRes.data as EventItem[]) || [])

      const locations = (locRes.data as LocationItem[]) || []
      setLocationMap(new Map(locations.map((l) => [l.id, l.name])))
      setLoading(false)
    }

    loadData()
  }, [])

  const fmtDate = (ts?: string): string => {
    if (!ts) return 'Ismeretlen dátum'
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ts.split('T')[0]
    return d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const fmtTime = (t?: string): string => (t ? t.slice(0, 5) : '')
  const locName = (ev: EventItem): string => locationMap.get(ev.location_id) || 'Helyszín nélkül'

  async function openModal(ev: EventItem) {
    setModalEvent(ev)
    setResult(null)
    setAck(false)
    setPrepping(true)
    setRecipients([])
    setNoEmail([])

    const { data: atts, error: attsErr } = await supabase
      .from('attendances')
      .select('profile_id')
      .eq('event_id', ev.id)

    if (attsErr) {
      console.error('Error fetching event attendances:', attsErr.message)
      setPrepping(false)
      return
    }

    const ids = Array.from(new Set((atts || []).map((a) => a.profile_id).filter(Boolean)))

    const recs: Recipient[] = []
    const none: NoEmailMember[] = []

    if (ids.length > 0) {
      const { data: profs, error: profsErr } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids)

      if (profsErr) {
        console.error('Error fetching attendee profiles:', profsErr.message)
      } else {
        for (const p of profs || []) {
          const name = p.full_name || 'Táncos'
          if (isValidEmail(p.email)) {
            recs.push({ name, email: p.email.trim() })
          } else {
            none.push({ name })
          }
        }
      }
    }

    setRecipients(recs)
    setNoEmail(none)

    const dateStr = fmtDate(ev.event_date)
    const loc = locName(ev)
    const startStr = fmtTime(ev.start_time)
    const endStr = fmtTime(ev.end_time)
    const timeStr = startStr && endStr ? `${startStr}–${endStr}` : startStr

    setSubject(`[IMI TÁRSASTÁNC] ELMARAD – ${dateStr}${startStr ? ` ${startStr}` : ''} | ${loc}`)
    setBody(
      `Kedves {{nev}}!\n\n` +
        `Az alábbi táncalkalom ELMARAD:\n\n` +
        `• Időpont: ${dateStr}${timeStr ? `, ${timeStr}` : ''}\n` +
        `• Helyszín: ${loc}\n` +
        (ev.title ? `• Megnevezés: ${ev.title}\n` : '') +
        `\nErre az alkalomra jelentkezni már nem lehet.\n\n` +
        `Üdvözlettel:\n\nImi`
    )
    setPrepping(false)
  }

  function closeModal() {
    setModalEvent(null)
    setResult(null)
  }

  async function finalize() {
    if (!modalEvent || !ack) return
    setSending(true)
    setResult(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setResult({ error: 'Hiányzó userId. Kérjük, jelentkezz be újra!' })
        return
      }

      const res = await fetch('/api/notify-event-cancelled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: modalEvent.id,
          userId: user.id,
          subject,
          body,
        }),
      })

      const json: CancellationResult = await res.json()

      if (!res.ok) {
        setResult({ error: json.error || 'Ismeretlen hiba.' })
      } else {
        setResult(json)
        setEvents((prev) =>
          prev.map((e) => (e.id === modalEvent.id ? { ...e, is_active: false } : e))
        )
      }
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : 'Hálózati hiba'
      setResult({ error: errMessage })
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="text-zinc-500 p-6">Alkalmak betöltése...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Alkalmak kezelése</h2>

      <div className="space-y-3">
        {events.map((ev) => {
          const inactive = ev.is_active === false
          return (
            <div
              key={ev.id}
              className={`rounded-2xl border p-3.5 bg-white ${
                inactive ? 'border-red-200 overflow-hidden' : 'border-zinc-200'
              }`}
            >
              {inactive && (
                <div className="mb-2.5 -mx-3.5 -mt-3.5 px-3.5 py-1 bg-red-600">
                  <span className="text-white font-extrabold text-xs tracking-wider uppercase">
                    TÖRÖLVE
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className={`min-w-0 flex-1 ${inactive ? 'line-through opacity-60' : ''}`}>
                  <p className="font-bold text-sm sm:text-base text-zinc-900 leading-snug">
                    {fmtDate(ev.event_date)}
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-600">
                    {fmtTime(ev.start_time)}
                    {ev.end_time ? `–${fmtTime(ev.end_time)}` : ''} · {locName(ev)}
                  </p>
                  {ev.title && <p className="text-xs text-zinc-500 truncate">{ev.title}</p>}
                </div>
                {!inactive && (
                  <button
                    onClick={() => openModal(ev)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 whitespace-nowrap shrink-0 transition-colors"
                  >
                    Inaktiválás
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {events.length === 0 && <p className="text-zinc-500">Nincs esemény.</p>}
      </div>

      {modalEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-700">Alkalom inaktiválása</h3>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              Ez a művelet <strong>nem visszavonható</strong>. Az inaktiválás után az alkalom „TÖRÖLVE”
              állapotba kerül, és nem lehet rá többé jelentkezni.
            </div>

            <div className="text-sm">
              <p className="font-semibold">
                {fmtDate(modalEvent.event_date)} · {locName(modalEvent)}
              </p>
              <p className="text-zinc-600">
                {fmtTime(modalEvent.start_time)}
                {modalEvent.end_time ? `–${fmtTime(modalEvent.end_time)}` : ''}
              </p>
            </div>

            {prepping ? (
              <p className="text-zinc-500 text-sm">Jelentkezők betöltése...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    Értesítendő jelentkezők ({recipients.length} fő)
                  </p>
                  {recipients.length > 0 ? (
                    <ul className="text-xs text-zinc-700 max-h-32 overflow-y-auto border rounded p-2 space-y-0.5">
                      {recipients.map((r) => (
                        <li key={r.email}>
                          {r.name} <span className="text-zinc-400">&lt;{r.email}&gt;</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-500">Nincs e-mailben értesíthető jelentkező.</p>
                  )}

                  {noEmail.length > 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      <p className="font-semibold">
                        Nincs e-mail címük ({noEmail.length} fő) — kézzel értesítendő:
                      </p>
                      <p>{noEmail.map((n) => n.name).join(', ')}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Tárgy</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                  />
                  <label className="block text-sm font-semibold">Levél szövege</label>
                  <p className="text-[11px] text-zinc-500">
                    A <code>{'{{nev}}'}</code> helyére minden címzettnél a saját neve kerül.
                  </p>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="w-full p-2 border rounded text-sm font-mono"
                  />
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Tudomásul veszem, hogy az inaktiválás <strong>végleges és nem visszavonható</strong>.
                  </span>
                </label>

                {result &&
                  (result.error ? (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                      {result.error}
                    </div>
                  ) : (
                    <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded p-2 space-y-1">
                      <p>Az alkalom inaktiválva.</p>
                      <p>Kiküldött e-mail: {result.sent?.length ?? 0} db.</p>
                      {result.skipped_no_email && result.skipped_no_email.length > 0 && (
                        <p>
                          E-mail nélkül (kézzel):{' '}
                          {result.skipped_no_email.map((s) => s.name).join(', ')}
                        </p>
                      )}
                      {result.failed && result.failed.length > 0 && (
                        <div className="text-red-700 bg-red-50 p-2 rounded text-xs space-y-1">
                          <p className="font-bold">Sikertelen küldés:</p>
                          {result.failed.map((f) => (
                            <p key={f.email}>
                              • {f.email}: <span className="font-mono text-[11px]">{f.error}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {result.warning && <p className="text-amber-700">{result.warning}</p>}
                    </div>
                  ))}

                <div className="flex gap-2 pt-2">
                  {!result || result.error ? (
                    <>
                      <button
                        onClick={finalize}
                        disabled={!ack || sending}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700"
                      >
                        {sending ? 'Küldés...' : 'Végleges inaktiválás és értesítés'}
                      </button>
                      <button onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">
                        Mégse
                      </button>
                    </>
                  ) : (
                    <button onClick={closeModal} className="flex-1 py-2 border rounded-lg">
                      Bezárás
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}