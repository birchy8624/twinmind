'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type JSX } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmModal } from '../_components/confirm-modal'
import { useToast } from '../_components/toast-context'
import { useCustomization } from '../_components/customization-context'
import { WorkspaceBrandmark } from '../_components/workspace-brandmark'
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
  const { settings: customizationSettings, resolvedTheme, setTheme, setBrandColor, setLogoUrl } = useCustomization()
  const [brandColorInput, setBrandColorInput] = useState(customizationSettings.brandColor)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setBrandColorInput(customizationSettings.brandColor)
  }, [customizationSettings.brandColor])

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

  type ThemeChoice = 'system' | 'light' | 'dark'

  const themeOptions: Array<{ value: ThemeChoice; label: string; description: string }> = [
    {
      value: 'system',
      label: 'Match system',
      description: 'Automatically switches with your OS appearance.'
    },
    {
      value: 'light',
      label: 'Light mode',
      description: 'Bright surfaces with higher contrast for daylight work.'
    },
    {
      value: 'dark',
      label: 'Dark mode',
      description: 'Low-light friendly surfaces with vivid accents.'
    }
  ]

  const themeIcons: Record<ThemeChoice, JSX.Element> = {
    system: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-white/70">
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </svg>
    ),
    light: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-white/70">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path
          d="M12 2v2m0 16v2m8-10h-2M6 12H4m13.657-7.657-1.414 1.414M7.757 16.243l-1.414 1.414m0-12.728 1.414 1.414m9.9 9.9 1.414 1.414"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
    dark: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-white/70">
        <path
          d="M21 12.79A9 9 0 0 1 11.21 3 6.5 6.5 0 1 0 21 12.79Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  const isValidHexColor = (value: string) => /^#?[0-9a-fA-F]{6}$/.test(value.trim())

  const normalizeHex = (value: string) => {
    const trimmed = value.trim()
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  }

  const applyBrandColor = (value: string, { showToast = true }: { showToast?: boolean } = {}) => {
    if (!isValidHexColor(value)) {
      pushToast({
        title: 'Use a valid hex code',
        description: 'Provide a 6 character hex value like #3366FF.',
        variant: 'error'
      })
      setBrandColorInput(customizationSettings.brandColor)
      return false
    }

    const normalized = normalizeHex(value)
    if (normalized === customizationSettings.brandColor) {
      setBrandColorInput(normalized)
      return true
    }
    setBrandColorInput(normalized)
    setBrandColor(normalized)

    if (showToast) {
      pushToast({
        title: 'Brand color updated',
        description: `Primary accents now use ${normalized.toUpperCase()}.`,
        variant: 'success'
      })
    }

    return true
  }

  const handleBrandColorPickerChange = (event: ChangeEvent<HTMLInputElement>) => {
    void applyBrandColor(event.target.value, { showToast: false })
  }

  const handleBrandColorInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBrandColorInput(event.target.value)
  }

  const handleBrandColorInputBlur = () => {
    if (!brandColorInput.trim()) {
      setBrandColorInput(customizationSettings.brandColor)
      return
    }

    void applyBrandColor(brandColorInput)
  }

  const handleBrandColorReset = () => {
    void applyBrandColor(DEFAULT_BRAND_COLOR)
  }

  const handleThemeSelection = (value: ThemeChoice) => {
    if (customizationSettings.theme === value) {
      return
    }

    setTheme(value)
    pushToast({
      title: 'Theme updated',
      description:
        value === 'system'
          ? `Following your system preference — currently ${resolvedTheme} mode.`
          : `Interface set to ${value} mode.`,
      variant: 'success'
    })
  }

  const handleLogoUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]

    if (!file) {
      return
    }

    setIsUploadingLogo(true)

    const finalize = () => {
      setIsUploadingLogo(false)
      input.value = ''
    }

    if (!file.type.startsWith('image/')) {
      pushToast({
        title: 'Unsupported file',
        description: 'Upload a PNG, JPG, or SVG logo.',
        variant: 'error'
      })
      finalize()
      return
    }

    if (file.size > LOGO_SIZE_LIMIT_BYTES) {
      const limitMb = (LOGO_SIZE_LIMIT_BYTES / (1024 * 1024)).toFixed(1)
      pushToast({
        title: 'Logo too large',
        description: `Please choose an image smaller than ${limitMb} MB.`,
        variant: 'error'
      })
      finalize()
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setLogoUrl(result)
        pushToast({
          title: 'Logo updated',
          description: `${file.name} will now appear in the navigation.`,
          variant: 'success'
        })
      } else {
        pushToast({
          title: 'Unable to read logo',
          description: 'Try converting the image to PNG or SVG and upload again.',
          variant: 'error'
        })
      }
    }

    reader.onerror = () => {
      pushToast({
        title: 'Upload failed',
        description: 'Something went wrong while reading the file. Please try another image.',
        variant: 'error'
      })
    }

    reader.onloadend = finalize
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoUrl(null)
    pushToast({
      title: 'Logo removed',
      description: 'The default TwinMind branding will be restored.',
      variant: 'success'
    })
  }

  const hasCustomLogo = Boolean(customizationSettings.logoUrl)
  const logoSizeLimitLabel = (LOGO_SIZE_LIMIT_BYTES / (1024 * 1024)).toFixed(1)
  const currentBrandColor = isValidHexColor(brandColorInput)
    ? normalizeHex(brandColorInput)
    : customizationSettings.brandColor

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Update workspace preferences, tailor branding, and manage critical actions.
        </p>
      </header>

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

        <motion.div
          layout
          className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-base-900/40 p-6 shadow-lg shadow-base-900/30 backdrop-blur"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Customization</h2>
            <p className="mt-1 text-sm text-white/60">Personalize the workspace experience for your team and clients.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Workspace logo</p>
                  <p className="text-xs text-white/60">Upload a PNG, JPG, or SVG up to {logoSizeLimitLabel} MB.</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasCustomLogo ? (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-300 hover:text-rose-100"
                    >
                      Remove logo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogoUploadClick}
                    disabled={isUploadingLogo}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploadingLogo ? 'Uploading…' : 'Upload logo'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-base-900/50 p-4">
                <WorkspaceBrandmark className="h-12 w-12" />
                <div className="flex-1 text-xs text-white/60">
                  {hasCustomLogo
                    ? 'Your custom logo now appears in navigation, reports, and shared assets.'
                    : 'Using the default TwinMind studio mark until a logo is uploaded.'}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoFileChange}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Theme</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {themeOptions.map((option) => {
                  const isActive = customizationSettings.theme === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleThemeSelection(option.value)}
                      className={`flex flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? 'border-white/40 bg-white/10 text-white'
                          : 'border-white/10 bg-base-900/50 text-white/70 hover:border-white/20 hover:bg-base-900/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {themeIcons[option.value]}
                        <span className="text-sm font-semibold">{option.label}</span>
                      </div>
                      <span className="text-xs text-white/50">{option.description}</span>
                      {option.value === 'system' ? (
                        <span className="text-[11px] uppercase tracking-wide text-white/40">Currently {resolvedTheme} mode</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Brand color</p>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-base-900/50 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10"
                    style={{
                      background: 'linear-gradient(135deg, rgb(var(--brand-color-100) / 1), rgb(var(--brand-color-500) / 1))'
                    }}
                  >
                    <span
                      className="h-8 w-8 rounded-lg border border-white/10"
                      style={{ backgroundColor: currentBrandColor }}
                    />
                  </span>
                  <input
                    type="color"
                    value={currentBrandColor}
                    onChange={handleBrandColorPickerChange}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                  />
                </div>
                <div className="flex flex-1 items-center gap-3 sm:justify-end">
                  <input
                    type="text"
                    value={brandColorInput}
                    onChange={handleBrandColorInputChange}
                    onBlur={handleBrandColorInputBlur}
                    placeholder="#A3FF12"
                    className="w-full rounded-lg border border-white/10 bg-base-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 sm:max-w-[140px]"
                  />
                  <button
                    type="button"
                    onClick={handleBrandColorReset}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
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
