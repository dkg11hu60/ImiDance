'use client'

import { useEffect } from 'react'

// Láthatatlan fordító-motor. Minden oldalon fut (a layout rendereli), betölti a
// Google oldalfordító elemet és alkalmazza a googtrans cookie-ban tárolt nyelvet.
// A nyelvet a nyitó oldalon lévő LangOffer állítja be; ez a komponens csak
// érvényesíti, bárhol jár a felhasználó. Eredeti nyelv: magyar.

export function TranslateBootstrap() {
  useEffect(() => {
    // Google-sáv elrejtése (ne tolja el az oldalt), a hátteret NEM bántjuk
    if (!document.getElementById('langoffer-style')) {
      const style = document.createElement('style')
      style.id = 'langoffer-style'
      style.textContent = `
        .goog-te-banner-frame.skiptranslate,
        .skiptranslate iframe,
        iframe.goog-te-banner-frame,
        .goog-te-gadget,
        #goog-gt-tt,
        .goog-te-balloon-frame { display: none !important; visibility: hidden !important; }
        body { top: 0 !important; }
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

  return null
}
