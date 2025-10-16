type StatusBadgeProps = {
  status: string
}

const statusStyles: Record<string, string> = {
  Active: 'bg-limeglow-500/10 text-limeglow-300 ring-1 ring-inset ring-limeglow-500/40',
  Onboarding: 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/40',
  'Proposal Sent': 'bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/40',
  Inactive: 'bg-zinc-500/10 text-zinc-300 ring-1 ring-inset ring-zinc-500/40',
  Discovery: 'bg-cyan-500/10 text-cyan-200 ring-1 ring-inset ring-cyan-500/40',
  'In Review': 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/40',
  'In Delivery': 'bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/40',
  Completed: 'bg-limeglow-500/10 text-limeglow-100 ring-1 ring-inset ring-limeglow-500/30',
  Blocked: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/40'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide'
  const variant = statusStyles[status] ?? 'bg-white/5 text-white/70 ring-1 ring-inset ring-white/20'
  return (
    <span className={`${baseClasses} ${variant}`}>
      {status}
    </span>
  )
}
