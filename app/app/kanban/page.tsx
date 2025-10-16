const columns = [
  { title: 'Leads', count: 4 },
  { title: 'Discovery', count: 2 },
  { title: 'In Delivery', count: 5 },
  { title: 'Wrap-up', count: 1 }
]

export default function KanbanPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-white/70">Visualize deal flow and drag-and-drop opportunities.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <div
            key={column.title}
            className="rounded-lg border border-dashed border-white/15 bg-base-900/30 p-4"
          >
            <div className="text-sm font-semibold text-white/80">{column.title}</div>
            <div className="mt-1 text-2xl font-semibold">{column.count}</div>
            <p className="mt-2 text-xs text-white/60">Drag cards here to update status.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
