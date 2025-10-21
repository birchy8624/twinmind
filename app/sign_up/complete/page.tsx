import type { Metadata } from 'next'

import CompleteSignUpClient from './CompleteSignUpClient'

import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Confirm your email | TwinMinds Studio',
  description:
    'Verify your TwinMinds Studio invitation so you can finish setting up your workspace and start collaborating with our team.',
}

export default function CompleteSignUpPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Navbar />
      <section className="relative flex flex-1 items-center border-y border-white/5 bg-base-900/40 py-20">
        <div className="pointer-events-none absolute inset-x-0 top-10 -z-10 flex justify-center">
          <div className="h-[24rem] w-[28rem] rounded-full bg-gradient-to-br from-limeglow-500/16 via-transparent to-transparent blur-3xl" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-[-6rem] -z-10 flex justify-center">
          <div className="h-[22rem] w-[26rem] rounded-full bg-gradient-to-t from-limeglow-700/20 via-transparent to-transparent blur-3xl" />
        </div>

        <div className="container grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6 text-center lg:text-left">
            <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">Confirm email</span>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Let&apos;s finish setting up your account
            </h1>
            <p className="leading-relaxed text-white/75">
              We&apos;re verifying your email address so you can access your TwinMinds Studio workspace, collaborate with our team,
              and stay aligned on your product roadmap.
            </p>
            <div className="rounded-2xl bg-base-900/70 px-6 py-5 ring-1 ring-white/10">
              <p className="text-sm text-white/65">
                Need help? Reach out to{' '}
                <a href="mailto:hello@twinminds.studio" className="text-limeglow-400 hover:text-limeglow-300">
                  hello@twinminds.studio
                </a>{' '}
                and our team will assist you.
              </p>
            </div>
          </div>

          <div className="card mx-auto w-full max-w-md p-8">
            <CompleteSignUpClient />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
