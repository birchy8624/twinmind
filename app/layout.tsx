import './globals.css'
import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.twinminds.studio/'
const previewImage = `${siteUrl.replace(/\/$/, '')}/twinminds-preview.jpg`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'TwinMinds — Human creativity, AI speed',
  description:
    'TwinMinds is an AI-driven startup studio. We discover niche markets, launch focused SaaS, and iterate fast. Human creativity, AI speed.',
  icons: { icon: '/favicon.svg' },
  keywords: [
    'AI web app development',
    'AI-powered MVP builder',
    'SaaS product studio',
    'startup MVP development',
    'rapid prototyping agency',
    'Next.js development studio',
    'Tailwind CSS experts',
    'AI app design and development',
    'AI-driven product design',
    'human + AI collaboration',
    'software prototyping',
    'custom web applications',
    'UX and UI design studio',
    'fast MVP launch partner',
    'product design and build agency',
    'TwinMinds Studio',
    'TwinMinds web apps',
    'AI software development studio'
  ],
  openGraph: {
    title: 'TwinMinds — Human creativity, AI speed',
    description:
      'TwinMinds is an AI-driven startup studio. We discover niche markets, launch focused SaaS, and iterate fast. Human creativity, AI speed.',
    url: siteUrl,
    siteName: 'TwinMinds Studio',
    type: 'website',
    images: [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: 'TwinMinds Studio marketing preview'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TwinMinds — Human creativity, AI speed',
    description:
      'TwinMinds is an AI-driven startup studio. We discover niche markets, launch focused SaaS, and iterate fast. Human creativity, AI speed.',
    images: [previewImage]
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-base-900 bg-tw-gradient">{children}</body>
    </html>
  )
}
