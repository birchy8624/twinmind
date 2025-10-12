export default function Footer(){
  return (
    <footer className="border-t border-white/5">
      <div className="container py-10 text-sm text-white/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div><span className="text-limeglow-500">Twin</span>Minds Studio. Where AI precision meets human creativity.</div>
        <div className="flex items-center gap-4">
          <a href="#services" className="hover:text-white">Services</a>
          <a href="#portfolio" className="hover:text-white">Portfolio</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#contact" className="hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  )
}
