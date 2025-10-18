import Link from 'next/link'

export default function UserManagementPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-base-900/60 p-8 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Workspace controls</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">User management</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70">
              Invite teammates, assign roles, and keep access aligned with your studio&apos;s workflow. This overview page will grow
              with additional capabilities soon, but for now you can head to settings to update profile details.
            </p>
          </div>
          <Link
            href="/app/settings"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-base-900/80 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:text-white"
          >
            Open settings
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: 'Invitations', description: 'Track pending invites and resend or revoke access when needed.' },
          { title: 'Roles', description: 'Define workspace responsibilities with owner and client-level permissions.' },
          { title: 'Security', description: 'Review authentication settings and session security policies.' }
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-white/10 bg-base-900/40 p-6 transition hover:border-white/20 hover:bg-base-900/60"
          >
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm text-white/60">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
