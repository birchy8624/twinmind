import type { Metadata } from 'next'

import ResetPasswordForm from './ResetPasswordForm'

import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Reset password | TwinMinds Studio',
  description: 'Choose a new password to securely access your TwinMinds Studio workspace.',
}

export default function ResetPasswordPage() {
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
            <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">Reset password</span>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Update your TwinMinds Studio password
            </h1>
            <p className="leading-relaxed text-white/75">
              We&rsquo;re here to help you get back into your workspace quickly and securely. Set a new password to continue
              collaborating with our team.
            </p>
            <div className="rounded-2xl bg-base-900/70 px-6 py-5 ring-1 ring-white/10">
              <p className="text-sm text-white/65">
                If you didn&rsquo;t request a password reset, please ignore the email and contact{' '}
                <a href="mailto:hello@twinminds.studio" className="text-limeglow-400 hover:text-limeglow-300">
                  hello@twinminds.studio
                </a>{' '}
                for assistance.
              </p>
            </div>
          </div>

          <div className="card mx-auto w-full max-w-md p-8">
            <ResetPasswordForm />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
