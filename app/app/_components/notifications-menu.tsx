'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

import { useActiveProfile } from './active-profile-context'

const COMMENTS = 'comments' as const

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const relativeTimeDivisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' }
]

function formatRelativeTimeFromNow(value: string | null) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  let duration = (date.getTime() - Date.now()) / 1000

  for (const division of relativeTimeDivisions) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }

  return 'Unknown time'
}

type CommentRow = Database['public']['Tables']['comments']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProjectRow = Database['public']['Tables']['projects']['Row']

type NotificationRecord = CommentRow & {
  author_profile: Pick<ProfileRow, 'id' | 'full_name' | 'role'> | null
  project: Pick<ProjectRow, 'id' | 'name' | 'account_id'> | null
}

type NotificationItem = {
  id: string
  body: string
  createdAt: string
  authorName: string
  projectName: string
  projectId: string | null
}

const SEEN_STORAGE_PREFIX = 'twinmind.notifications.seen.'

type NotificationsMenuProps = {
  className?: string
  triggerClassName?: string
}

function resolveNotificationItem(record: NotificationRecord): NotificationItem | null {
  if (!record.id || !record.created_at) {
    return null
  }

  const authorName = record.author_profile?.full_name?.trim() || 'A teammate'
  const projectName = record.project?.name?.trim() || 'Unknown project'

  return {
    id: record.id,
    body: record.body ?? '',
    createdAt: record.created_at,
    authorName,
    projectName,
    projectId: record.project?.id ?? null
  }
}

export function NotificationsMenu({ className, triggerClassName }: NotificationsMenuProps = {}) {
  const supabase = useMemo(createBrowserClient, [])
  const { account, loading: profileLoading, profile } = useActiveProfile()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement | null>(null)

  const accountId = account?.id ?? null
  const storageKey = profile?.id ? `${SEEN_STORAGE_PREFIX}${profile.id}` : null

  useEffect(() => {
    if (!storageKey) {
      setSeenIds(new Set())
      return
    }

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        setSeenIds(new Set())
        return
      }

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setSeenIds(new Set())
        return
      }

      const next = new Set<string>()
      for (const value of parsed) {
        if (typeof value === 'string' && value.trim().length > 0) {
          next.add(value)
        }
      }
      setSeenIds(next)
    } catch (cause) {
      console.error('Failed to parse seen notifications', cause)
      setSeenIds(new Set())
    }
  }, [storageKey])

  const fetchNotifications = useCallback(async () => {
    if (profileLoading || !profile?.id || !accountId) {
      return
    }

    setLoading(true)
    setError(null)

    const query = supabase
      .from(COMMENTS)
      .select(
        `
          id,
          body,
          created_at,
          visibility,
          project:project_id ( id, name, account_id ),
          author_profile:author_profile_id ( id, full_name, role )
        `
      )
      .neq('author_profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .eq('project.account_id', accountId)

    const { data, error: fetchError } = await query

    if (fetchError) {
      console.error('Failed to load notifications', fetchError)
      setNotifications([])
      setError('We could not load notifications. Please try again soon.')
      setLoading(false)
      return
    }

    const records = (data ?? []) as NotificationRecord[]

    const resolved = records
      .map(resolveNotificationItem)
      .filter((item): item is NotificationItem => item !== null)

    setNotifications(resolved)
    setLoading(false)
  }, [accountId, profile?.id, profileLoading, supabase])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (open) {
      void fetchNotifications()
    }
  }, [fetchNotifications, open])

  useEffect(() => {
    if (!open || !storageKey || notifications.length === 0) {
      return
    }

    const next = new Set(seenIds)
    let hasChanges = false

    for (const notification of notifications) {
      if (!next.has(notification.id)) {
        next.add(notification.id)
        hasChanges = true
      }
    }

    if (!hasChanges) {
      return
    }

    setSeenIds(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)))
    } catch (cause) {
      console.error('Failed to persist seen notifications', cause)
    }
  }, [notifications, open, seenIds, storageKey])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const unreadCount = notifications.reduce((count, notification) => {
    return seenIds.has(notification.id) ? count : count + 1
  }, 0)

  const hasUnread = unreadCount > 0
  const visibleNotifications = notifications.slice(0, 5)

  const containerClassName = ['relative', className]
    .filter(Boolean)
    .join(' ')

  const triggerClasses = [
    'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-base-900/60 text-white/70 transition hover:border-white/20 hover:text-white',
    triggerClassName
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={containerRef} className={containerClassName}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={triggerClasses}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="sr-only">View notifications</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        </svg>
        {hasUnread ? <span className="absolute right-2 top-2 block h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-80 origin-top-right rounded-3xl border border-white/10 bg-base-900/90 p-4 shadow-2xl backdrop-blur"
          >
            <header className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Notifications</p>
                <p className="text-xs text-white/50">Latest project comments</p>
              </div>
              {hasUnread ? (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-200">
                  {unreadCount} new
                </span>
              ) : null}
            </header>

            {loading ? (
              <p className="py-6 text-center text-sm text-white/60">Loading notifications…</p>
            ) : error ? (
              <p className="py-6 text-center text-sm text-red-300">{error}</p>
            ) : visibleNotifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/60">You&rsquo;re all caught up.</p>
            ) : (
              <ul className="space-y-3">
                {visibleNotifications.map((notification) => {
                  const timeAgo = formatRelativeTimeFromNow(notification.createdAt)
                  const unread = !seenIds.has(notification.id)
                  const snippet = notification.body.trim() || 'New comment'

                  return (
                    <li
                      key={notification.id}
                      className={`group rounded-2xl border border-white/10 p-3 transition ${
                        unread ? 'bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.1)]' : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-limeglow-400/80" aria-hidden />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium text-white">
                            {notification.authorName} <span className="font-normal text-white/60">commented on</span> {notification.projectName}
                          </p>
                          <p className="line-clamp-2 text-sm text-white/70">{snippet}</p>
                          <div className="flex items-center justify-between text-xs text-white/50">
                            <span>{timeAgo}</span>
                            {notification.projectId ? (
                              <a
                                href={`/app/projects/${notification.projectId}`}
                                className="text-xs font-medium text-limeglow-300 transition hover:text-limeglow-200"
                              >
                                View project
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {notifications.length > 5 ? (
              <p className="mt-4 text-center text-xs text-white/50">Showing the 5 most recent updates.</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
