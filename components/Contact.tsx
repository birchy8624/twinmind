'use client'
import { useState } from 'react'
import Section from './Section'

const highlights = [
  { label: 'Avg. kickoff', value: '48h' },
  { label: 'Discovery duration', value: '1 week' },
  { label: 'Launch support', value: '30 days' },
]

export default function Contact(){
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const accessKey = '2430f7c4-bacc-423c-aad1-8a976b352b37'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    const formElement = e.currentTarget
    if (!accessKey) {
      setStatus('error')
      console.error('Missing Web3Forms access key.')
      return
    }

    setStatus('sending')
    const form = new FormData(formElement)
    form.append('access_key', accessKey)
    form.append('subject', 'TwinMinds Studio – Website enquiry')
    form.append('from_name', form.get('name')?.toString() ?? '')

    const email = form.get('email')?.toString() ?? ''
    form.append('replyto', email)

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: form
      })

      if (!response.ok) {
        const error = await response.json().catch(()=>({ message: 'Unknown error' }))
        console.error('Web3Forms error:', error)
        throw new Error(error.message ?? 'Failed to submit form.')
      }

      const result = await response.json()
      if (!result.success) {
        console.error('Web3Forms failure:', result)
        throw new Error(result.message ?? 'Submission failed.')
      }

      setStatus('sent')
      formElement.reset()
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <Section id="contact" muted className="relative overflow-hidden border-y border-white/5">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -z-10 flex justify-center">
        <div className="h-[26rem] w-[32rem] rounded-full bg-gradient-to-br from-limeglow-500/18 via-transparent to-transparent blur-3xl"></div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[-10rem] -z-10 flex justify-center">
        <div className="h-[24rem] w-[28rem] rounded-full bg-gradient-to-t from-limeglow-700/14 via-transparent to-transparent blur-3xl"></div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="card relative flex flex-col gap-6 overflow-hidden p-10 text-center lg:text-left">
          <div className="absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-limeglow-500/15 to-transparent" />
          <span className="text-sm uppercase tracking-[0.4em] text-limeglow-500/70">Let’s collaborate</span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Bring your idea to life</h2>
          <p className="text-white/75 leading-relaxed">
            Tell us what you’re building and we’ll design the path to ship. Discovery workshops, roadmap, and first build in partnership.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.label} className="rounded-2xl bg-base-900/80 px-4 py-3 text-center shadow-inner shadow-black/20 ring-1 ring-white/10">
                <div className="text-lg font-semibold text-white">{item.value}</div>
                <div className="mt-1 text-[0.65rem] uppercase tracking-[0.28em] text-white/55">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-base-900/70 p-5 ring-1 ring-white/10">
            <div className="text-sm text-white/60">Email</div>
            <a className="text-lg font-medium text-limeglow-500" href="mailto:hello@twinminds.studio">hello@twinminds.studio</a>
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-8">
          <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <div>
            <label className="block text-sm text-white/80">Name</label>
            <input name="name" required className="mt-1 w-full bg-base-700/60 rounded-xl px-4 py-3 ring-1 ring-white/10 focus:ring-limeglow-500/40 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-white/80">Email</label>
            <input type="email" name="email" required className="mt-1 w-full bg-base-700/60 rounded-xl px-4 py-3 ring-1 ring-white/10 focus:ring-limeglow-500/40 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-white/80">Project Idea</label>
            <textarea name="message" rows={4} className="mt-1 w-full bg-base-700/60 rounded-xl px-4 py-3 ring-1 ring-white/10 focus:ring-limeglow-500/40 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-white/80">Budget Range</label>
            <select name="budget" className="mt-1 w-full bg-base-700/60 rounded-xl px-4 py-3 ring-1 ring-white/10 focus:ring-limeglow-500/40 outline-none">
              <option>€2,500–€5,000</option>
              <option>€5,000–€10,000</option>
              <option> €10,000</option>
            </select>
          </div>
          <button className="btn btn-primary w-full sm:w-auto" disabled={status==='sending'}>
            {status==='sending' ? 'Sending…' : 'Book a Call'}
          </button>
          {status==='sent' && <p className="text-green-400 text-sm">Thanks! We’ll be in touch shortly.</p>}
          {status==='error' && <p className="text-red-400 text-sm">Something went wrong. Please try again.</p>}
        </form>
      </div>
    </Section>
  )
}
