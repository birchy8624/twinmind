import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import Projects from '@/components/Projects'
import Process from '@/components/Process'
import Pricing from '@/components/Pricing'
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
      <Services />
      <Projects />
      <Process />
      <Pricing />
      <About />
      <Contact />
      <Footer />
    </main>
  )
}
