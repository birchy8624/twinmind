const steps = [
  {
    title: 'Company profile',
    description: 'Basic info, primary contacts, and billing preferences.'
  },
  {
    title: 'Project goals',
    description: 'Outline objectives, stakeholders, and desired outcomes.'
  },
  {
    title: 'Kickoff logistics',
    description: 'Schedule calls, confirm communication channels, and assign owners.'
  }
]

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Client Onboarding</h1>
        <p className="text-sm text-white/70">Guide new partners through a structured wizard.</p>
      </header>
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-dashed border-white/15 bg-base-900/30 p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Step {index + 1}</div>
            <div className="text-lg font-medium">{step.title}</div>
            <p className="text-sm text-white/65">{step.description}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
