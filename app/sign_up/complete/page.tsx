import type { Metadata } from 'next'

import CompleteSignUpForm from './CompleteSignUpForm'

import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Complete your TwinMinds sign up',
  description:
    'Confirm your email, add your name and company details, and get ready to create your first TwinMinds client.'
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

        <div className="container">
          <CompleteSignUpForm />
        </div>
      </section>
      <Footer />
    </main>
  )
}
