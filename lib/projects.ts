export type Project = {
  name: string
  description: string
  tech: string[]
  url: string
  image?: string
}

export const projects: Project[] = [
  {
    name: 'ShowGO',
    description: 'Event advertising platform for discovering trending events in Paris.',
    tech: ['React','Tailwind','Supabase','OpenAI'],
    url: 'https://showgo-seven.vercel.app/',
    image: '/images/projects/showgo.jpg'
  },
  {
    name: 'Wheelzy',
    description: 'Bike rental service web app with booking flows and admin dashboards.',
    tech: ['React','Node','Postgres'],
    url: 'https://wheelzy-xi.vercel.app/',
    image: '/images/projects/wheelzy.jpg'
  },
  {
    name: 'Croydon Netball Club',
    description: 'League management portal with fixtures, squads, and live scoring.',
    tech: ['Next.js','Supabase','Maps'],
    url: 'https://example.com/croydon-netball',
    image: '/images/projects/croydon-netball.jpg'
  },
  {
    name: 'Pulse CRM',
    description: 'Unified customer intelligence hub with workflows, tagging, and AI summaries.',
    tech: ['React','Node','Postgres','LangChain'],
    url: 'https://example.com/pulse-crm',
    image: '/images/projects/pulse-crm.jpg'
  }
]
