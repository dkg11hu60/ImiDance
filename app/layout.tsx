import './globals.css'
import { HelpButton } from '@/components/help/HelpButton'
import { TranslateBootstrap } from '@/components/i18n/TranslateBootstrap'

export const metadata = {
  title: 'Imi Társastánc',
  description: 'Imi Társastánc alkalmazás',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hu" suppressHydrationWarning>
      {/* A dance-bg egy belső wrapperen van, NEM a <body>-n: így a Google-fordító
          body-manipulációja nem tudja elvinni a háttérképet. */}
      <body>
        <div className="dance-bg min-h-screen">
          {/* Láthatatlan fordító-motor minden oldalon — a nyitó oldalon választott
              nyelvet érvényesíti a cookie alapján, bárhol jár a felhasználó. */}
          <TranslateBootstrap />
          {children}
          <HelpButton />
        </div>
      </body>
    </html>
  )
}
