import type { Metadata } from 'next'

import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'

import ResetPasswordForm from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Reset password | TwinMinds Studio',
  description:
    'Choose a new password for your TwinMinds Studio account so you can securely access your workspace again.',
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

        <div className="container grid items-center justify-center gap-12">
          <div className="card mx-auto w-full max-w-xl p-8">
            <ResetPasswordForm />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
