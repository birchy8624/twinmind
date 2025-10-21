import Checkout from '@/app/components/checkout'

export default function BillingCheckoutPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Complete your upgrade</p>
        <h1 className="text-3xl font-semibold text-white">Secure checkout</h1>
        <p className="text-sm text-white/60">
          Enter your payment details below to activate TwinMind Premium for your workspace.
        </p>
      </header>
      <div className="rounded-3xl border border-white/10 bg-base-900/70 p-4 shadow-[0_25px_70px_-25px_rgba(157,242,85,0.25)]">
        <Checkout />
      </div>
    </div>
  )
}
