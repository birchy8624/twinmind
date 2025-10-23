import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import WhatWeDo from '@/components/WhatWeDo'
import Projects from '@/components/Projects'
import Approach from '@/components/Approach'
import About from '@/components/About'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

type PageProps = {
  searchParams?: {
    signed_out?: string
  }
}

export default function Page({ searchParams }: PageProps){
  const isSignedOut = searchParams?.signed_out === '1'

  return (
    <main>
      <Navbar />
      {isSignedOut ? (
        <div className="border-y border-limeglow-500/30 bg-limeglow-500/10">
          <div className="container py-3 text-center text-sm font-medium text-limeglow-300" role="status">
            Signed Out
          </div>
        </div>
      ) : null}
      <Hero />
      <About />
      <WhatWeDo />
      <Approach />
      <Projects />
      <Contact />
      <Footer />
    </main>
  )
}
