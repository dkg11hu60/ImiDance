'use client'

import { useEffect, useState } from 'react'

// Böngészős (Google) oldalfordító felajánló — CSAK a nyitó (login) oldalra szánva.
// Egy kattintással lefordítja az egész oldalt magyarról a választott nyelvre.
// A választást a googtrans cookie őrzi, ami újratöltéskor magától érvényesül,
// így a korábbi választás lesz az alapértelmezett, de váltható marad.
// Eredeti nyelv: magyar (pageLanguage: 'hu').

interface LangDef {
  code: string   // googtrans célnyelv-kód ('hu' = eredeti)
  label: string
  Flag: () => JSX.Element
}

// --- Zászlók beágyazott SVG-ként (Windowson az emoji-zászlók nem renderelnek) ---

const FlagHU = () => (
  <svg viewBox="0 0 9 6" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
    <rect width="9" height="2" y="0" fill="#ce2939" />
    <rect width="9" height="2" y="2" fill="#ffffff" />
    <rect width="9" height="2" y="4" fill="#477050" />
  </svg>
)

const FlagEN = () => (
  // Egyszerűsített Union Jack
  <svg viewBox="0 0 60 30" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
    <clipPath id="langoffer-uk-s"><path d="M0 0v30h60V0z" /></clipPath>
    <clipPath id="langoffer-uk-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath>
    <g clipPath="url(#langoffer-uk-s)">
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0 60 30m0-30L0 30" stroke="#ffffff" strokeWidth="6" />
      <path d="M0 0 60 30m0-30L0 30" clipPath="url(#langoffer-uk-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#ffffff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
)

const FlagZH = () => (
  // Kína: piros mező, sárga csillagok (★ glyph, nem emoji → Windowson is rendereli)
  <svg viewBox="0 0 30 20" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
    <rect width="30" height="20" fill="#de2910" />
    <g fill="#ffde00" fontFamily="serif">
      <text x="1.5" y="9" fontSize="7">★</text>
      <text x="8.5" y="3.6" fontSize="2.6">★</text>
      <text x="10.5" y="6" fontSize="2.6">★</text>
      <text x="10.5" y="9.4" fontSize="2.6">★</text>
      <text x="8.5" y="11.8" fontSize="2.6">★</text>
    </g>
  </svg>
)

const FlagVI = () => (
  // Vietnám: piros mező, középen egy nagy sárga ötágú csillag
  <svg viewBox="0 0 30 20" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
    <rect width="30" height="20" fill="#da251d" />
    <text x="15" y="15.5" fontSize="15" fill="#ffff00" textAnchor="middle" fontFamily="serif">★</text>
  </svg>
)

const LANGS: LangDef[] = [
  { code: 'hu', label: 'Magyar', Flag: FlagHU },
  { code: 'en', label: 'English', Flag: FlagEN },
  { code: 'zh-CN', label: '中文', Flag: FlagZH },
  { code: 'vi', label: 'Tiếng Việt', Flag: FlagVI }
]

function readCurrentLang(): string {
  if (typeof document === 'undefined') return 'hu'
  const m = document.cookie.match(/googtrans=\/hu\/([\w-]+)/)
  return m ? m[1] : 'hu'
}

function setGoogTransCookie(target: string) {
  // target 'hu' = eredeti (töröljük a cookie-t), különben /hu/<cél>
  const value = target === 'hu' ? '' : `/hu/${target}`
  const host = typeof location !== 'undefined' ? location.hostname : ''
  document.cookie = `googtrans=${value};path=/`
  if (host && host.includes('.')) {
    document.cookie = `googtrans=${value};path=/;domain=${host}`
    document.cookie = `googtrans=${value};path=/;domain=.${host}`
  }
}

export function LangOffer() {
  const [current, setCurrent] = useState<string>('hu')

  useEffect(() => {
    setCurrent(readCurrentLang())

    // Google-sáv elrejtése, hogy ne tolja el az oldalt
    if (!document.getElementById('langoffer-style')) {
      const style = document.createElement('style')
      style.id = 'langoffer-style'
      style.textContent = `
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        .goog-te-gadget { display: none !important; }
        body { top: 0 !important; position: static !important; }
        #goog-gt-tt, .goog-te-balloon-frame { display: none !important; }
        .goog-text-highlight { background: none !important; box-shadow: none !important; }
      `
      document.head.appendChild(style)
    }

    if (!document.getElementById('google_translate_element')) {
      const div = document.createElement('div')
      div.id = 'google_translate_element'
      div.style.display = 'none'
      document.body.appendChild(div)
    }

    if (!document.getElementById('google-translate-script')) {
      ;(window as any).googleTranslateElementInit = () => {
        try {
          const g = (window as any).google
          if (g?.translate?.TranslateElement) {
            // eslint-disable-next-line no-new
            new g.translate.TranslateElement(
              { pageLanguage: 'hu', autoDisplay: false },
              'google_translate_element'
            )
          }
        } catch {
          // csendes: ha nem elérhető, marad az eredeti nyelv
        }
      }
      const s = document.createElement('script')
      s.id = 'google-translate-script'
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
      document.body.appendChild(s)
    }
  }, [])

  const translateTo = (target: string) => {
    if (target === current) return
    setGoogTransCookie(target)
    // A googtrans cookie a betöltéskor érvényesül a fordító-elemmel
    location.reload()
  }

  return (
    <div className="w-full max-w-md mx-auto flex items-center justify-center gap-2" translate="no">
      {LANGS.map((l) => {
        const active = current === l.code
        const Flag = l.Flag
        return (
          <button
            key={l.code}
            onClick={() => translateTo(l.code)}
            title={l.label}
            aria-label={l.label}
            aria-pressed={active}
            className={`block w-11 h-7 rounded overflow-hidden border transition-all ${
              active
                ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-sm'
                : 'border-zinc-300/70 opacity-70 hover:opacity-100 hover:border-zinc-400'
            }`}
          >
            <Flag />
          </button>
        )
      })}
    </div>
  )
}
