type StatusBadgeProps = {
  status: string
}

const statusStyles: Record<string, string> = {
  Active:
    'bg-limeglow-500/20 text-limeglow-700 ring-1 ring-inset ring-limeglow-500/40 dark:bg-limeglow-500/10 dark:text-limeglow-300 dark:ring-limeglow-500/40',
  Onboarding:
    'bg-sky-500/20 text-sky-700 ring-1 ring-inset ring-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/40',
  'Proposal Sent':
    'bg-purple-500/20 text-purple-700 ring-1 ring-inset ring-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/40',
  Inactive:
    'bg-zinc-500/20 text-zinc-700 ring-1 ring-inset ring-zinc-500/40 dark:bg-zinc-500/10 dark:text-zinc-300 dark:ring-zinc-500/40',
  Discovery:
    'bg-limeglow-500/20 text-limeglow-700 ring-1 ring-inset ring-limeglow-500/40 dark:bg-limeglow-500/10 dark:text-limeglow-200 dark:ring-limeglow-500/40',
  'In Review':
    'bg-amber-500/20 text-amber-700 ring-1 ring-inset ring-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/40',
  'In Delivery':
    'bg-indigo-500/20 text-indigo-700 ring-1 ring-inset ring-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/40',
  Backlog:
    'bg-sky-500/20 text-sky-700 ring-1 ring-inset ring-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/40',
  'Call Arranged':
    'bg-sky-500/20 text-sky-700 ring-1 ring-inset ring-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/40',
  'Brief Gathered':
    'bg-amber-500/20 text-amber-700 ring-1 ring-inset ring-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/40',
  'UI Stage':
    'bg-purple-500/20 text-purple-700 ring-1 ring-inset ring-purple-500/40 dark:bg-purple-500/10 dark:text-purple-200 dark:ring-purple-500/40',
  'DB Stage':
    'bg-cyan-500/20 text-cyan-700 ring-1 ring-inset ring-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-500/40',
  'Auth Stage':
    'bg-indigo-500/20 text-indigo-700 ring-1 ring-inset ring-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/40',
  Build:
    'bg-limeglow-500/20 text-limeglow-700 ring-1 ring-inset ring-limeglow-500/40 dark:bg-limeglow-500/10 dark:text-limeglow-200 dark:ring-limeglow-500/40',
  QA:
    'bg-amber-500/20 text-amber-700 ring-1 ring-inset ring-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/40',
  Handover:
    'bg-emerald-500/20 text-emerald-700 ring-1 ring-inset ring-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/40',
  Closed:
    'bg-zinc-500/20 text-zinc-700 ring-1 ring-inset ring-zinc-500/40 dark:bg-zinc-500/10 dark:text-zinc-200 dark:ring-zinc-500/40',
  'In Progress':
    'bg-indigo-500/20 text-indigo-700 ring-1 ring-inset ring-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/40',
  Completed:
    'bg-limeglow-500/20 text-limeglow-700 ring-1 ring-inset ring-limeglow-500/30 dark:bg-limeglow-500/10 dark:text-limeglow-100 dark:ring-limeglow-500/30',
  Blocked:
    'bg-rose-500/20 text-rose-700 ring-1 ring-inset ring-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/40',
  Invited:
    'bg-sky-500/20 text-sky-700 ring-1 ring-inset ring-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30',
  Archived:
    'bg-zinc-500/20 text-zinc-700 ring-1 ring-inset ring-zinc-500/40 dark:bg-zinc-800/30 dark:text-zinc-200 dark:ring-zinc-600/40',
  Unknown:
    'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300 dark:bg-white/5 dark:text-white/70 dark:ring-white/20'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide'
  const variant =
    statusStyles[status] ?? 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300 dark:bg-white/5 dark:text-white/70 dark:ring-white/20'
  return (
    <span className={`${baseClasses} ${variant}`}>
      {status}
    </span>
  )
}
