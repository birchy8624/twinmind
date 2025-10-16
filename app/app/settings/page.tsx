'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmModal } from '../_components/confirm-modal'
import { useToast } from '../_components/toast-context'

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  title: z.string().min(2, 'Title is required'),
  email: z.string().email('Enter a valid email')
})

type ProfileFormValues = z.infer<typeof profileSchema>

const notificationSchema = z.object({
  weeklyDigest: z.boolean(),
  clientAlerts: z.boolean(),
  commentMentions: z.boolean()
})

type NotificationFormValues = z.infer<typeof notificationSchema>

export default function SettingsPage() {
  const { pushToast } = useToast()
  const [resetModalOpen, setResetModalOpen] = useState(false)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    defaultValues: {
      name: 'Evelyn Lopez',
      title: 'Engagement Lead',
      email: 'evelyn@twinmind.studio'
    }
  })

  const notificationForm = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    mode: 'onChange',
    defaultValues: {
      weeklyDigest: true,
      clientAlerts: true,
      commentMentions: true
    }
  })

  const handleProfileSubmit = profileForm.handleSubmit(
    (values) => {
      pushToast({
        title: 'Profile updated',
        description: `${values.name}, your workspace preferences are synced.`,
        variant: 'success'
      })
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
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            {profileForm.formState.errors.name ? (
              <span className="text-xs font-medium text-rose-300">{profileForm.formState.errors.name.message}</span>
            ) : null}
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Role / title</span>
            <input
              type="text"
              {...profileForm.register('title')}
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            {profileForm.formState.errors.title ? (
              <span className="text-xs font-medium text-rose-300">{profileForm.formState.errors.title.message}</span>
            ) : null}
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Email</span>
            <input
              type="email"
              {...profileForm.register('email')}
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            {profileForm.formState.errors.email ? (
              <span className="text-xs font-medium text-rose-300">{profileForm.formState.errors.email.message}</span>
            ) : null}
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition btn-gradient"
          >
            Save profile
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
                  className="mt-1 h-4 w-4 rounded border border-white/20 bg-base-950 text-emerald-400 focus:ring-emerald-400"
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
