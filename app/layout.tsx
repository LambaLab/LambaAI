import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter-sans' })
const bebas = localFont({
  src: '../public/fonts/BebasNeue-Regular.ttf',
  variable: '--font-bebas-neue',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Lamba Lab — Build Something',
  description: 'Tell us your idea. Get a real proposal.',
}

// Blocking inline script that runs BEFORE first paint.
// Checks localStorage for an active session and hides the landing page
// so the user never sees a flash of the homepage before React hydrates.
const ANTI_FLASH_SCRIPT = `
(function(){
  try {
    if (localStorage.getItem('lamba_session')) {
      document.documentElement.classList.add('has-session');
    }
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLASH_SCRIPT }} />
      </head>
      <body className="bg-brand-dark text-brand-white font-inter antialiased">
        {children}
      </body>
    </html>
  )
}
