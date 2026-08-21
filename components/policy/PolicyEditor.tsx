'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type Section = { key: string; heading: string; body: string }

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'szakasz'
}

export function PolicyEditor() {
  const [title, setTitle] = useState('Tánciskolai Házirend')
  const [sections, setSections] = useState<Section[]>([])
  const [currentVersion, setCurrentVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: pol } = await supabase
        .from('policies')
        .select('version, title, sections')
        .eq('is_current', true)
        .maybeSingle()
      if (pol) {
        setTitle(pol.title)
        setSections((pol.sections as Section[]) || [])
        setCurrentVersion(pol.version)
      }
      setLoading(false)
    }
    load()
  }, [])

  function updateSection(i: number, field: keyof Section, value: string) {
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function addSection() {
    setSections(prev => [...prev, { key: '', heading: '', body: '' }])
  }

  function removeSection(i: number) {
    setSections(prev => prev.filter((_, idx) => idx !== i))
  }

  function move(i: number, dir: -1 | 1) {
    setSections(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function publish() {
    setMessage(null)

    if (!title.trim()) { setMessage({ text: 'A cím nem lehet üres.', error: true }); return }
    if (sections.length === 0) { setMessage({ text: 'Legalább egy szakasz kell.', error: true }); return }

    const seen = new Set<string>()
    const prepared: Section[] = sections.map(s => {
      let key = s.key.trim() || slugify(s.heading)
      let base = key, n = 1
      while (seen.has(key)) { key = `${base}-${n++}` }
      seen.add(key)
      return { key, heading: s.heading.trim(), body: s.body }
    })

    for (const s of prepared) {
      if (!s.heading) { setMessage({ text: 'Minden szakaszhoz kell cím.', error: true }); return }
    }

    setPublishing(true)
    try {
      const res = await fetch('/api/policy-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), sections: prepared }),
      })

      const contentType = res.headers.get('content-type')
      let json: any = {}
      if (contentType && contentType.includes('application/json')) {
        json = await res.json()
      } else {
        throw new Error(`A szerver nem JSON választ adott (${res.status} ${res.statusText}). Ellenőrizd az API útvonalat!`)
      }

      if (!res.ok) {
        setMessage({ text: json.error || 'A kiadás nem sikerült.', error: true })
      } else {
        setCurrentVersion(json.version)
        setShowPreview(false)
        setMessage({ text: `Új házirend kiadva (v${json.version}). Mindenkinek újra el kell fogadnia.`, error: false })
      }
    } catch (e: any) {
      setMessage({ text: e?.message || 'Hálózati hiba.', error: true })
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <div className="text-zinc-500">Házirend betöltése…</div>

  const nextVersionNumber = (currentVersion || 0) + 1

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold text-zinc-900">Házirend szerkesztése</h2>
        {currentVersion !== null && (
          <span className="text-xs text-zinc-500">Jelenlegi élő verzió: v{currentVersion}</span>
        )}
      </div>

      <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2">
        A kiadás új verziót hoz létre, és a régit lekapcsolja. Ezután <strong>minden tagnak</strong> újra el kell
        fogadnia a belépéskor. Kiadás előtt az <strong>Előnézet</strong> gombbal ellenőrizhető a végleges felület.
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-zinc-600 mb-1">Cím</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono"
        />
      </div>

      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={i} className="border border-zinc-200 rounded-xl p-4 space-y-2 bg-white">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-400">Szakasz {i + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="px-2 py-1 text-xs rounded border border-zinc-200 disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === sections.length - 1}
                  className="px-2 py-1 text-xs rounded border border-zinc-200 disabled:opacity-30">↓</button>
                <button onClick={() => removeSection(i)}
                  className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50">Törlés</button>
              </div>
            </div>

            <input
              value={s.heading}
              onChange={e => updateSection(i, 'heading', e.target.value)}
              placeholder="Szakasz címe (pl. Óralátogatás)"
              className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-mono"
            />
            <textarea
              value={s.body}
              onChange={e => updateSection(i, 'body', e.target.value)}
              rows={4}
              placeholder="A szakasz szövege."
              className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-mono"
            />
          </div>
        ))}
      </div>

      <button
        onClick={addSection}
        className="w-full py-2 border border-dashed border-zinc-300 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        + Új szakasz
      </button>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-end pt-2">
        <button
          onClick={() => setShowPreview(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          Előnézet
        </button>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                  Előnézet (v{nextVersionNumber})
                </span>
                <h3
                  className="text-lg font-bold text-indigo-600 mt-1 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic"
                  dangerouslySetInnerHTML={{ __html: title || 'Cím nélkül' }}
                />
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {sections.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">Még nincsenek szakaszok hozzáadva.</p>
              ) : (
                sections.map((s, idx) => (
                  <div key={idx} className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div
                      className="px-4 py-2 bg-zinc-50 font-bold text-sm text-zinc-900 border-b border-zinc-100 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic"
                      dangerouslySetInnerHTML={{ __html: s.heading || `Szakasz ${idx + 1}` }}
                    />
                    <div 
                      className="px-4 py-3 text-sm text-zinc-700 leading-snug whitespace-pre-line [&_p]:mb-1 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_a]:text-indigo-600 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: s.body || 'Üres szöveg...' }}
                    />
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-100"
              >
                Szerkesztés folytatása
              </button>
              <button
                onClick={publish}
                disabled={publishing}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {publishing ? 'Kiadás…' : 'Új verzió kiadása'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}