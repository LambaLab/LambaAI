import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter-sans' })
const bebas = localFont({
  src: '../public/fonts/BebasNeue-Regular.ttf',
  variable: '--font-bebas-neue',
})

export const metadata: Metadata = {
  title: 'Lamba Lab — Build Something',
  description: 'Tell us your idea. Get a real proposal.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable}`}>
      <body className="bg-brand-dark text-brand-white font-inter antialiased">
        {children}
      </body>
    </html>
  )
}
