'use client'

import { motion } from 'framer-motion'

import { StatusBadge } from '../_components/status-badge'

const columns = [
  {
    title: 'Leads',
    description: 'New conversations and inbound interest.',
    cards: [
      { title: 'Lumen Finance — Growth Sprint', status: 'Discovery', owner: 'Sasha', eta: 'Intro next week' },
      { title: 'Orbit Labs — Portal Build', status: 'Discovery', owner: 'Linh', eta: 'Proposal drafted' }
    ]
  },
  {
    title: 'Discovery',
    description: 'Scoping phase and workshop prep.',
    cards: [
      { title: 'Northwind Analytics — Data Room', status: 'In Review', owner: 'Elijah', eta: 'Brief sign-off' },
      { title: 'Atlas Robotics — Brand Refresh', status: 'In Delivery', owner: 'Evelyn', eta: 'Research synthesis' }
    ]
  },
  {
    title: 'In Delivery',
    description: 'Active build and iteration.',
    cards: [
      { title: 'Aurora Health — Knowledge Base', status: 'In Delivery', owner: 'Mason', eta: 'QA Thursday' },
      { title: 'Cascade Ventures — CRM', status: 'Blocked', owner: 'Evelyn', eta: 'Waiting on access' }
    ]
  },
  {
    title: 'Wrap-up',
    description: 'Final polish and handoff.',
    cards: [
      { title: 'Acme Robotics — Atlas UI', status: 'In Review', owner: 'Sasha', eta: 'Handoff Friday' }
    ]
  }
] as const

export default function KanbanPage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">Kanban</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Keep pulse on the delivery pipeline. Drag cards during live sessions to rebalance workloads.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column, columnIndex) => (
          <motion.div
            key={column.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: columnIndex * 0.05, duration: 0.22, ease: 'easeOut' }}
            className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-base-900/40 p-4 shadow-lg shadow-base-900/30 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">{column.title}</h2>
                <p className="text-xs text-white/60">{column.description}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {column.cards.length}
              </span>
            </div>
            <div className="space-y-3">
              {column.cards.map((card) => (
                <motion.article
                  key={card.title}
                  whileHover={{ y: -2, boxShadow: '0 12px 30px rgba(59,130,246,0.22)' }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="space-y-3 rounded-2xl border border-white/10 bg-base-900/60 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{card.title}</p>
                    <p className="text-xs text-white/50">Owner: {card.owner}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <StatusBadge status={card.status} />
                    <span>{card.eta}</span>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
