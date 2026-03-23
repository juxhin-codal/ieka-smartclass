import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'IEKA SmartClass - Sistemi i Menaxhimit të Trajnimeve',
  description: 'Platforma zyrtare për rezervimin e sesioneve të trajnimit, regjistrimin e prezencës dhe ndjekjen e orëve të zhvillimit të vazhdueshëm profesional (CPD) për Institutin e Ekspertëve Kontabël të Autorizuar.',
  keywords: ['IEKA', 'SmartClass', 'Trajnime', 'CPD', 'Ekspertë Kontabël', 'Zhvillim Profesional'],
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'IEKA SmartClass - Sistemi i Menaxhimit të Trajnimeve',
    description: 'Menaxhoni trajnimet tuaja profesionale me lehtësi. Rezervoni vendin tuaj, verifikoni prezencën tuaj me QR kod dhe gjurmoni pikët tuaja CPD.',
    url: 'https://smartclass.ieka.al',
    siteName: 'IEKA SmartClass',
    images: [
      {
        url: '/og-image.png',
        width: 1024,
        height: 1024,
        alt: 'IEKA SmartClass Logo',
      },
    ],
    locale: 'sq_AL',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sq">
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
