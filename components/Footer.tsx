export default function Footer(){
  return (
    <footer className="border-t border-white/5">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 text-center text-sm text-white/60 md:flex-row md:text-left">
        <div className="max-w-xl text-balance"><span className="text-limeglow-500">Twin</span>Minds Studio. Where AI precision meets human creativity.</div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:justify-end">
          <a href="#services" className="hover:text-white">Services</a>
          <a href="#portfolio" className="hover:text-white">Portfolio</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#contact" className="hover:text-white">Contact</a>
          <a href="/sign_in" className="hover:text-white">Sign In</a>
        </div>
      </div>
    </footer>
  )
}
