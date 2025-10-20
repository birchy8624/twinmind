'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmModal } from '../_components/confirm-modal'
import { useToast } from '../_components/toast-context'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { Database } from '@/types/supabase'

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  role: z.enum(['owner', 'member'], {
    errorMap: () => ({ message: 'Select a workspace role' })
  }),
  email: z.string().email('Enter a valid email')
})

type ProfileFormValues = z.infer<typeof profileSchema>

const notificationSchema = z.object({
  weeklyDigest: z.boolean(),
  clientAlerts: z.boolean(),
  commentMentions: z.boolean()
})

type NotificationFormValues = z.infer<typeof notificationSchema>

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
type RoleEnum = Database['public']['Enums']['account_role']

const PROFILES = 'profiles' as const
const DEFAULT_ROLE: RoleEnum = 'member'

const ROLE_LABELS: Record<RoleEnum, string> = {
  owner: 'Owner',
  member: 'Team member'
}
const ROLE_OPTIONS: Array<{ value: RoleEnum; label: string }> = [
  { value: 'owner', label: ROLE_LABELS.owner },
  { value: 'member', label: ROLE_LABELS.member }
]

const BRAND_COLOR_STORAGE_KEY = 'tm:brandColor' as const
const THEME_STORAGE_KEY = 'tm:themePreference' as const
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/
const DEFAULT_BRAND_COLOR = '#A3FF12'
const THEME_CHOICES = [
  {
    value: 'system',
    label: 'System default',
    description: 'Follow each member’s device preference.'
  },
  {
    value: 'dark',
    label: 'Midnight',
    description: 'Keep the immersive dark theme for everyone.'
  }
] as const

type ThemeChoice = (typeof THEME_CHOICES)[number]['value']

const DEFAULT_THEME: ThemeChoice = 'system'

const normalizeBrandColor = (value: string): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return null
  }

  if (trimmed.length === 4) {
    const upper = trimmed.toUpperCase()
    return `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`
  }

  return trimmed.toUpperCase()
}

const hexToRgba = (value: string, alpha: number) => {
  const normalized = normalizeBrandColor(value)

  if (!normalized) {
    return `rgba(163, 255, 18, ${alpha})`
  }

  const numeric = parseInt(normalized.slice(1), 16)
  const r = (numeric >> 16) & 0xff
  const g = (numeric >> 8) & 0xff
  const b = numeric & 0xff

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const readStoredBrandColor = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_BRAND_COLOR
  }

  const stored = window.localStorage.getItem(BRAND_COLOR_STORAGE_KEY)
  const normalized = stored ? normalizeBrandColor(stored) : null

  if (!normalized) {
    window.localStorage.removeItem(BRAND_COLOR_STORAGE_KEY)
    return DEFAULT_BRAND_COLOR
  }

  return normalized
}

const applyBrandColor = (value: string): string | null => {
  const normalized = normalizeBrandColor(value)

  if (!normalized) {
    return null
  }

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.style.setProperty('--tm-brand-accent', normalized)
    root.dataset.brandColor = normalized
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BRAND_COLOR_STORAGE_KEY, normalized)
  }

  return normalized
}

const isThemeChoice = (value: unknown): value is ThemeChoice =>
  typeof value === 'string' && THEME_CHOICES.some((choice) => choice.value === value)

const readStoredThemeChoice = (): ThemeChoice => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeChoice(stored) ? stored : DEFAULT_THEME
}

const applyThemePreference = (choice: ThemeChoice) => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.dataset.themePreference = choice
  root.dataset.theme = 'dark'
  root.classList.add('dark')
  root.style.setProperty('color-scheme', 'dark')

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice)
  }
}


const resolveMetadataName = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) {
    return null
  }

  const firstName = typeof metadata['first_name'] === 'string' ? metadata['first_name'] : null
  const lastName = typeof metadata['last_name'] === 'string' ? metadata['last_name'] : null
  const fullName = typeof metadata['full_name'] === 'string' ? metadata['full_name'] : null
  const nameCandidate =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : fullName ?? firstName ?? (typeof metadata['name'] === 'string' ? metadata['name'] : null)

  const trimmed = typeof nameCandidate === 'string' ? nameCandidate.trim() : ''

  return trimmed ? trimmed : null
}

const resolveMetadataRole = (metadata: Record<string, unknown> | undefined): RoleEnum | null => {
  if (!metadata) {
    return null
  }

  const keysToCheck = ['role', 'title', 'position']

  for (const key of keysToCheck) {
    const value = metadata[key]
    if (typeof value !== 'string') {
      continue
    }

    const normalized = value.trim().toLowerCase()

    if (normalized === 'owner') {
      return 'owner'
    }

    if (normalized === 'member') {
      return 'member'
    }
  }

  return null
}

const toRoleLabel = (role: RoleEnum) => ROLE_LABELS[role]

export default function SettingsPage() {
  const { pushToast } = useToast()
  const supabase = useMemo(createBrowserClient, [])
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR)
  const [themePreference, setThemePreference] = useState<ThemeChoice>(DEFAULT_THEME)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      role: DEFAULT_ROLE,
      email: ''
    }
  })

  useEffect(() => {
    const storedBrandColor = readStoredBrandColor()
    setBrandColor(storedBrandColor)
    applyBrandColor(storedBrandColor)

    const storedTheme = readStoredThemeChoice()
    setThemePreference(storedTheme)
    applyThemePreference(storedTheme)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (isMounted) {
        setIsLoadingProfile(true)
      }

      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          if (isMounted) {
            setActiveProfileId(null)
          }
          return
        }

        const metadataName = resolveMetadataName(user.user_metadata)
        const metadataRole = resolveMetadataRole(user.user_metadata)

        const { data: profile, error: profileError } = await supabase
          .from(PROFILES)
          .select('id, full_name, role, email')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          throw profileError
        }

        const resolvedName = profile?.full_name?.trim() || metadataName || user.email || ''
        const resolvedRole = profile?.role ?? metadataRole ?? DEFAULT_ROLE
        const resolvedEmail = profile?.email?.trim() || user.email || ''

        if (isMounted) {
          setActiveProfileId(user.id)
          profileForm.reset(
            {
              name: resolvedName,
              role: resolvedRole,
              email: resolvedEmail
            },
            { keepDirty: false }
          )
        }
      } catch (error) {
        console.error('Failed to load profile', error)

        if (isMounted) {
          setActiveProfileId(null)
          pushToast({
            title: 'Unable to load profile',
            description: 'Refresh the page to try again or contact support if the issue continues.',
            variant: 'error'
          })
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [profileForm, pushToast, supabase])

  const notificationForm = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    mode: 'onChange',
    defaultValues: {
      weeklyDigest: true,
      clientAlerts: true,
      commentMentions: true
    }
  })

  const handleBrandColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const applied = applyBrandColor(event.target.value)

    if (!applied) {
      pushToast({
        title: 'Invalid brand color',
        description: 'Pick a hex value like #A3FF12 to continue.',
        variant: 'error'
      })
      return
    }

    setBrandColor(applied)
  }

  const handleBrandColorCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      pushToast({
        title: 'Clipboard unavailable',
        description: 'Copy the hex value manually instead.',
        variant: 'error'
      })
      return
    }

    try {
      await navigator.clipboard.writeText(brandColor)
      pushToast({
        title: 'Brand color copied',
        description: `${brandColor} saved to your clipboard.`,
        variant: 'success'
      })
    } catch (error) {
      console.error('Failed to copy brand color', error)
      pushToast({
        title: 'Unable to copy brand color',
        description: 'Copy the hex value manually.',
        variant: 'error'
      })
    }
  }

  const handleBrandColorReset = () => {
    const applied = applyBrandColor(DEFAULT_BRAND_COLOR)

    if (!applied) {
      return
    }

    setBrandColor(applied)
    pushToast({
      title: 'Brand color reset',
      description: 'Accent styling reverted to the default TwinMind glow.',
      variant: 'success'
    })
  }

  const handleThemeSelection = (value: ThemeChoice) => {
    if (value === themePreference) {
      return
    }

    setThemePreference(value)
    applyThemePreference(value)

    const choice = THEME_CHOICES.find((option) => option.value === value)
    pushToast({
      title: `${choice?.label ?? 'Theme'} applied`,
      description:
        value === 'system'
          ? 'Workspace theme now follows each member’s device setting.'
          : 'Workspace theme stays locked to dark mode for everyone.',
      variant: 'success'
    })
  }

  const handleProfileSubmit = profileForm.handleSubmit(
    async (values) => {
      const userId = activeProfileId

      if (!userId) {
        pushToast({
          title: 'No active profile',
          description: 'You need to be signed in to update your profile.',
          variant: 'error'
        })
        return
      }

      const trimmedName = values.name.trim()
      const trimmedEmail = values.email.trim()
      const role = values.role

      try {
        const payload: ProfileInsert = {
          id: userId,
          full_name: trimmedName,
          role,
          email: trimmedEmail,
          updated_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from(PROFILES)
          .upsert(payload)
          .eq('id', userId)

        if (error) {
          throw error
        }

        profileForm.reset(
          {
            name: trimmedName,
            role,
            email: trimmedEmail
          },
          { keepDirty: false }
        )

        pushToast({
          title: 'Profile updated',
          description: `${trimmedName}, your workspace preferences are synced as ${toRoleLabel(role)}.`,
          variant: 'success'
        })
      } catch (error) {
        console.error('Failed to update profile', error)
        pushToast({
          title: 'Unable to save profile',
          description: 'Something went wrong while saving. Please try again.',
          variant: 'error'
        })
      }
    },
    () =>
      pushToast({
        title: 'Check your details',
        description: 'Correct the highlighted fields to save changes.',
        variant: 'error'
      })
  )

  const handleNotificationsSubmit = notificationForm.handleSubmit(
    (values) => {
      const enabledCount = Object.values(values).filter(Boolean).length
      pushToast({
        title: 'Notifications saved',
        description: `${enabledCount} channels enabled for delivery updates.`,
        variant: 'success'
      })
    },
    () =>
      pushToast({
        title: 'Unable to save preferences',
        description: 'Toggle at least one channel so you never miss a client update.',
        variant: 'error'
      })
  )

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Update workspace preferences, control notifications, and manage critical actions.
        </p>
      </header>

      <motion.div
        layout
        className="rounded-3xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Workspace appearance</h2>
          <p className="mt-1 text-sm text-white/60">
            Personalize the accent color and theme teammates see across the workspace.
          </p>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <label className="space-y-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Accent color</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={handleBrandColorChange}
                  aria-label="Workspace brand color"
                  className="h-14 w-14 cursor-pointer appearance-none overflow-hidden rounded-full border border-white/10 bg-transparent p-0"
                />
                <div className="flex flex-1 items-center justify-between rounded-full border border-white/10 bg-base-900/60 px-4 py-2">
                  <span className="font-mono text-sm text-white">{brandColor}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBrandColorCopy}
                      className="text-xs font-semibold uppercase tracking-wide text-white/60 transition hover:text-white"
                    >
                      Copy
                    </button>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ backgroundColor: brandColor }}
                    />
                  </div>
                </div>
              </div>
            </label>
            <button
              type="button"
              onClick={handleBrandColorReset}
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/20 hover:text-white"
            >
              Reset to default
            </button>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Theme</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {THEME_CHOICES.map((option) => {
                const isActive = option.value === themePreference

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeSelection(option.value)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? 'bg-base-900/80 text-white'
                        : 'border-white/10 bg-base-900/40 text-white/70 hover:border-white/20 hover:bg-base-900/50 hover:text-white'
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: brandColor,
                            boxShadow: `0 0 24px ${hexToRgba(brandColor, 0.32)}`
                          }
                        : undefined
                    }
                  >
                    <span className="font-semibold text-white">{option.label}</span>
                    <span className="mt-1 block text-xs text-white/50">{option.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.form
          layout
          onSubmit={handleProfileSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Profile</h2>
            <p className="mt-1 text-sm text-white/60">Synced with the client portal and reporting surfaces.</p>
          </div>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Display name</span>
            <input
              type="text"
              {...profileForm.register('name')}
              disabled={isLoadingProfile || profileForm.formState.isSubmitting}
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            />
            {profileForm.formState.errors.name ? (
              <span className="text-xs font-medium text-rose-300">{profileForm.formState.errors.name.message}</span>
            ) : null}
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Workspace role</span>
            <select
              {...profileForm.register('role')}
              disabled={isLoadingProfile || profileForm.formState.isSubmitting}
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {profileForm.formState.errors.role ? (
              <span className="text-xs font-medium text-rose-300">{profileForm.formState.errors.role.message}</span>
            ) : null}
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Email</span>
            <input
              type="email"
              {...profileForm.register('email')}
              disabled={isLoadingProfile || profileForm.formState.isSubmitting}
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            />
            {profileForm.formState.errors.email ? (
              <span className="text-xs font-medium text-rose-300">{profileForm.formState.errors.email.message}</span>
            ) : null}
          </label>
          <button
            type="submit"
            disabled={isLoadingProfile || profileForm.formState.isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition btn-gradient disabled:cursor-not-allowed disabled:opacity-70"
          >
            {profileForm.formState.isSubmitting ? 'Saving…' : 'Save profile'}
          </button>
        </motion.form>

        <motion.form
          layout
          onSubmit={handleNotificationsSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="mt-1 text-sm text-white/60">Control how you&apos;re notified about project progress.</p>
          </div>
          <fieldset className="space-y-3">
            {[
              {
                id: 'weeklyDigest',
                label: 'Weekly digest',
                description: 'Summary of progress, blockers, and upcoming milestones every Monday.'
              },
              {
                id: 'clientAlerts',
                label: 'Client alerts',
                description: 'Real-time notifications when clients comment or request updates.'
              },
              {
                id: 'commentMentions',
                label: 'Mentions',
                description: 'Pinged when teammates mention you in delivery threads.'
              }
            ].map((option) => (
              <label
                key={option.id}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-base-900/50 px-4 py-3 text-sm text-white/70 transition hover:border-white/20 hover:bg-base-900/60"
              >
                <input
                  type="checkbox"
                  {...notificationForm.register(option.id as keyof NotificationFormValues)}
                  className="mt-1 h-4 w-4 rounded border border-limeglow-500/40 bg-base-950 accent-limeglow-500 focus:ring-limeglow-500/40"
                />
                <span>
                  <span className="font-semibold text-white">{option.label}</span>
                  <span className="mt-1 block text-xs text-white/50">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/10 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Save preferences
          </button>
        </motion.form>
      </div>

      <motion.div
        layout
        className="rounded-3xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Workspace reset</h2>
            <p className="text-sm text-white/60">
              Clear tasks, kanban lanes, and stored files to start fresh for a new client season.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center justify-center rounded-full border border-rose-400/40 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-300 hover:text-rose-100"
          >
            Reset workspace
          </button>
        </div>
      </motion.div>

      <ConfirmModal
        open={resetModalOpen}
        title="Reset the workspace?"
        description="This clears demo data for clients, projects, and uploads."
        confirmLabel="Confirm reset"
        onCancel={() => setResetModalOpen(false)}
        onConfirm={() => {
          setResetModalOpen(false)
          pushToast({
            title: 'Workspace reset',
            description: 'Demo data cleared. Invite the team to start capturing real work.',
            variant: 'success'
          })
        }}
      />
    </section>
  )
}
