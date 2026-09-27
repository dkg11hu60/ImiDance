'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getCapturedLogs, formatLogsForReport } from '@/lib/consoleTracker'

interface HelpReportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpReportModal({ isOpen, onClose }: HelpReportModalProps) {
  const [description, setDescription] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [showConsoleLogs, setShowConsoleLogs] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [logCount, setLogCount] = useState({ total: 0, errors: 0 })

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Load active user info if available
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          setUserEmail(user.email || '')
          const { data: prof } = await supabase
            .from('profiles')
            .select('name, full_name')
            .eq('id', user.id)
            .maybeSingle()

          if (prof) {
            setUserName(prof.full_name || prof.name || '')
          }
        }
      } catch {
        // Continue unauthenticated
      }
    }

    loadUser()

    // Calculate logs
    const logs = getCapturedLogs()
    const errorCount = logs.filter(l => l.level === 'error').length
    setLogCount({ total: logs.length, errors: errorCount })
    setErrorMsg(null)
    setSuccessMsg(null)
  }, [isOpen])

  // Support paste from clipboard anywhere while modal is open
  useEffect(() => {
    if (!isOpen) return

    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            readImageFile(file)
            e.preventDefault()
            break
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen])

  function readImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Kérjük, kép formátumú fájlt válassz (PNG, JPG, WEBP).')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('A kép mérete túl nagy (maximum 8 MB megengedett).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setScreenshot(reader.result as string)
      setScreenshotName(file.name || 'vágólapról_beillesztve.png')
      setErrorMsg(null)
    }
    reader.readAsDataURL(file)
  }

  async function captureDisplayMedia() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setErrorMsg('A böngésződ nem támogatja a közvetlen képernyőfotó készítést. Kérjük, csatold fájlként vagy illeszd be vágólapról (Ctrl+V).')
        return
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as any
      })

      const track = stream.getVideoTracks()[0]
      const imageCapture = (window as any).ImageCapture ? new (window as any).ImageCapture(track) : null

      if (imageCapture) {
        const bitmap = await imageCapture.grabFrame()
        track.stop()
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(bitmap, 0, 0)
        setScreenshot(canvas.toDataURL('image/png'))
        setScreenshotName(`képernyőfotó_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.png`)
      } else {
        const video = document.createElement('video')
        video.srcObject = stream
        video.play()
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(video, 0, 0)
          track.stop()
          setScreenshot(canvas.toDataURL('image/png'))
          setScreenshotName(`képernyőfotó_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.png`)
        }
      }
      setErrorMsg(null)
    } catch {
      // User cancelled capture dialog
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      setErrorMsg('A küldéshez a hozzájárulás megadása szükséges.')
      return
    }
    if (!description.trim()) {
      setErrorMsg('Kérjük, írd le a tapasztalt problémát.')
      return
    }

    setSending(true)
    setErrorMsg(null)

    try {
      const payload = {
        description: description.trim(),
        userName: userName.trim() || null,
        userEmail: userEmail.trim() || null,
        userId: userId || null,
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} (képernyő: ${window.screen?.width}x${window.screen?.height})` : '',
        consoleLogs: formatLogsForReport(),
        screenshot: screenshot || null,
        consent: true
      }

      const res = await fetch('/api/send-help-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'A jelentés elküldése nem sikerült.')
      }

      setSuccessMsg('Köszönjük! A hibajelentést és a csatolt adatokat sikeresen továbbítottuk a fejlesztőnek (dkg11hu@gmail.com). Hamarosan kivizsgáljuk a hibát!')
      setTimeout(() => {
        onClose()
        setDescription('')
        setScreenshot(null)
        setScreenshotName(null)
        setConsent(false)
        setSuccessMsg(null)
      }, 3500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Hiba történt a küldés során.')
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-zinc-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🆘</span>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">Segítség & Hibabejelentés</h2>
              <p className="text-xs text-zinc-500">Közvetlen értesítés a fejlesztőnek (dkg11hu@gmail.com)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm flex-1">
          {successMsg ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center space-y-2">
              <span className="text-3xl">✅</span>
              <p className="font-bold text-base">Sikeresen elküldve!</p>
              <p className="text-xs leading-relaxed">{successMsg}</p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Felhasználó adatai */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Neved (opcionális)</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Pl. Hajnal Antal"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">E-mail címed (válaszhoz)</label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="email@pelda.hu"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Hiba leírása */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Milyen hibát tapasztaltál? Mit szerettél volna csinálni? <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Írd le röviden a problémát (pl. le akartam mondani az órát, de nem jelent meg a Lemondom gomb; hibaüzenetet kaptam; stb.)..."
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-xs bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
              </div>

              {/* Képernyőkép csatolása */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700">
                  Képernyőkép csatolása (opcionális)
                </label>

                {screenshot ? (
                  <div className="relative border border-zinc-200 rounded-2xl p-2 bg-zinc-50 flex items-center gap-3">
                    <img
                      src={screenshot}
                      alt="Csatolt képernyőkép"
                      className="w-20 h-16 object-cover rounded-xl border border-zinc-200 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{screenshotName || 'Képernyőkép csatolva'}</p>
                      <p className="text-[10px] text-emerald-600 font-medium">✓ Sikeresen csatolva a levélhez</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshot(null)
                        setScreenshotName(null)
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Eltávolítás
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>📁</span>
                        <span>Kép kiválasztása</span>
                      </button>

                      <button
                        type="button"
                        onClick={captureDisplayMedia}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Képernyő vagy ablak fotózása"
                      >
                        <span>📸</span>
                        <span>Fotózás most</span>
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readImageFile(file)
                      }}
                    />
                    <p className="text-[11px] text-zinc-400">
                      💡 Tipp: Nyomj <strong>Ctrl+V</strong>-t a vágólapra másolt képernyőfotó azonnali beillesztéséhez!
                    </p>
                  </div>
                )}
              </div>

              {/* Konzol diagnosztika áttekintése */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50">
                <button
                  type="button"
                  onClick={() => setShowConsoleLogs(v => !v)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">⚙️</span>
                    <span className="text-xs font-semibold text-zinc-800">
                      Automatikus diagnosztika (konzol napló)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200 text-zinc-700 font-bold">
                      {logCount.total} bejegyzés
                    </span>
                    {logCount.errors > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                        {logCount.errors} hiba
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 font-bold">{showConsoleLogs ? '▲ Elrejt' : '▼ Megtekintés'}</span>
                </button>

                {showConsoleLogs && (
                  <div className="p-3 bg-zinc-900 text-zinc-200 font-mono text-[10px] max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-zinc-200 select-all">
                    {formatLogsForReport()}
                  </div>
                )}
              </div>

              {/* Hozzájárulási nyilatkozat */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs leading-snug text-indigo-950 font-medium">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>
                    <strong>Hozzájárulok</strong>, hogy a fenti leírás, a technikai diagnosztika (konzol napló) és az esetleges képernyőkép elküldésre kerüljön a fejlesztőnek (<code>dkg11hu@gmail.com</code>) a hiba kivizsgálása céljából.
                  </span>
                </label>
              </div>

              {/* Gombok */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  disabled={sending || !consent || !description.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {sending ? (
                    <>
                      <span className="animate-spin inline-block">⏳</span>
                      <span>Küldés folyamatban...</span>
                    </>
                  ) : (
                    <>
                      <span>✉️</span>
                      <span>Bejelentés elküldése</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
