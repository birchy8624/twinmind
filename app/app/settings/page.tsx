export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-white/70">Manage your personal profile, notifications, and workspace preferences.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-base-900/30 p-4">
          <h2 className="text-sm font-semibold text-white/80">Profile</h2>
          <p className="mt-2 text-sm text-white/65">
            Update your display name, avatar, and contact information synced across the platform.
          </p>
        </section>
        <section className="rounded-lg border border-white/10 bg-base-900/30 p-4">
          <h2 className="text-sm font-semibold text-white/80">Notifications</h2>
          <p className="mt-2 text-sm text-white/65">
            Configure email digests, Slack alerts, and client portal updates.
          </p>
        </section>
      </div>
    </div>
  )
}
