import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import Projects from '@/components/Projects'
import Process from '@/components/Process'
import Pricing from '@/components/Pricing'
import About from '@/components/About'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function Page(){
  return (
    <main>
      <Navbar />
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
