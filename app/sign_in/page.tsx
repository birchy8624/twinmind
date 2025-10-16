import type { Metadata } from 'next'
import Link from 'next/link'

import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Sign in | TwinMinds Studio',
  description:
    'Access your TwinMinds Studio workspace to collaborate with our team, review progress, and stay aligned on your project.',
}

export default function SignInPage() {
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
            <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">Welcome back</span>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sign in to TwinMinds Studio</h1>
            <p className="leading-relaxed text-white/75">
              Continue your collaboration with our team, monitor milestones, and keep your product roadmap on track.
            </p>
            <div className="rounded-2xl bg-base-900/70 px-6 py-5 ring-1 ring-white/10">
              <p className="text-sm text-white/65">
                New to TwinMinds Studio?{' '}
                <Link href="#contact" className="text-limeglow-400 hover:text-limeglow-300">
                  Book a discovery call
                </Link>{' '}
                to get started.
              </p>
            </div>
          </div>

          <div className="card mx-auto w-full max-w-md p-8">
            <form className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm text-white/80">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm text-white/80">
                    Password
                  </label>
                  <Link href="#" className="text-xs font-medium text-limeglow-400 hover:text-limeglow-300">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-2 w-full rounded-xl bg-base-700/60 px-4 py-3 text-base text-white ring-1 ring-white/10 outline-none transition focus:ring-2 focus:ring-limeglow-500/40"
                  placeholder="Enter your password"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-white/70">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" name="remember" className="h-4 w-4 rounded border-white/30 bg-base-800/80" />
                  Remember me
                </label>
                <span className="text-xs text-white/50">Secure workspace access</span>
              </div>
              <button type="submit" className="btn btn-primary w-full">
                Sign in
              </button>
              <p className="text-center text-sm text-white/60">
                Don’t have an account yet?{' '}
                <Link href="#contact" className="text-limeglow-400 hover:text-limeglow-300">
                  Talk to our team
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
