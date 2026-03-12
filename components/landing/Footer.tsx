export default function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-white/5">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-bebas text-2xl text-brand-white tracking-widest">LAMBA LAB</span>
        <p className="text-brand-gray-mid text-sm">
          © {new Date().getFullYear()} Lamba Lab. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
