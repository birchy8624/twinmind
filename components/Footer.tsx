export default function Footer(){
  return (
    <footer className="border-t border-white/5">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 text-center text-sm text-white/60 md:flex-row md:text-left">
        <div className="max-w-xl text-balance">Building focused software for focused audiences.</div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:justify-end">
          <a href="#about" className="hover:text-white">About</a>
          <a href="#what-we-do" className="hover:text-white">What We Do</a>
          <a href="#approach" className="hover:text-white">Approach</a>
          <a href="#projects" className="hover:text-white">Projects</a>
          <a href="#contact" className="hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  )
}
