import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TwinMinds Studio. AI + Human Craft for Beautiful, Fast Web Apps',
  description: 'Where AI speed meets human creativity. Build smarter and ship faster with TwinMinds Studio. MVPs, web apps, internal tools, and AI integrations.',
  icons: { icon: '/favicon.svg' },
  keywords: ['AI web app development','AI-powered MVP builder','SaaS product studio','startup MVP development','rapid prototyping agency','Next.js development studio','Tailwind CSS experts','AI app design and development','AI-driven product design','human + AI collaboration','software prototyping','custom web applications','UX and UI design studio','fast MVP launch partner','product design and build agency','TwinMind Studio','TwinMind web apps','AI software development studio']
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-base-900 bg-tw-gradient">
        {children}
      </body>
    </html>
  )
}
