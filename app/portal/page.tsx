export default function PortalHomePage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Welcome to your TwinMinds portal</h2>
      <p className="text-sm text-white/70">
        Access shared updates, deliverables, and collaboration notes tailored to your organization.
      </p>
      <div className="rounded-lg border border-white/10 bg-base-900/30 p-4">
        <h3 className="text-sm font-semibold text-white/80">Next milestone</h3>
        <p className="mt-2 text-sm text-white/65">
          Our team will deliver the next sprint demo on Tuesday at 10:00 AM EST. Check the projects section for agenda
          details and links.
        </p>
      </div>
    </section>
  )
}
