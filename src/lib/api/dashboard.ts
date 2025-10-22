import { apiFetch } from './fetch'

type PipelineOverviewItem = {
  stage: string
  count: number
}

type RevenuePerformanceItem = {
  period: string
  quoted: number
  invoiced: number
  paid: number
}

type WinRate = {
  quotes: number
  paid: number
}

type StaleProject = {
  id: string
  name: string
  client: string
  lastUpdatedAt: string | null
  daysSinceUpdate: number | null
}

type UpcomingProject = {
  id: string
  name: string
  client: string
  dueIn: number | null
}

type ActivityFeedItem = {
  id: string
  author: string
  description: string
  timeAgo: string
}

type DashboardResponse = {
  pipelineOverview: PipelineOverviewItem[]
  revenuePerformance: RevenuePerformanceItem[]
  winRate: WinRate
  staleProjects: StaleProject[]
  upcomingProjects: UpcomingProject[]
  activityFeed: ActivityFeedItem[]
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('Failed to parse JSON response:', error, text)
    throw new Error('Unexpected response from API.')
  }
}

export async function fetchDashboardSummary() {
  const response = await apiFetch('/api/dashboard')

  if (!response.ok) {
    const body = await parseJson<{ message?: string }>(response)
    throw new Error(body.message ?? 'Unable to load dashboard data.')
  }

  return parseJson<DashboardResponse>(response)
}

export type {
  PipelineOverviewItem,
  RevenuePerformanceItem,
  WinRate,
  StaleProject,
  UpcomingProject,
  ActivityFeedItem,
  DashboardResponse,
}
