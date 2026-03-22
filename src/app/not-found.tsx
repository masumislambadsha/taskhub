import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FFF9E5] flex flex-col">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-[#FFF9E5]/80 backdrop-blur-xl">
        <Link
          href="/"
          className="text-2xl font-black tracking-tight text-primary font-headline"
        >
          TaskHub
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/login"
            className="text-sm font-semibold text-primary hover:text-secondary transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-6 pt-20 pb-12">
        <div className="max-w-2xl w-full text-center space-y-12">
          <div className="relative inline-block">
            <div className="absolute -top-6 -right-10 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col items-center">
              <h1 className="font-headline font-black text-[10rem] leading-none text-primary tracking-tighter opacity-10 select-none">
                404
              </h1>
              <div className="absolute inset-0 flex items-center justify-center pt-8">
                <div className="bg-white/80 backdrop-blur-xl shadow-xl p-8 rounded-xl border border-primary/5 flex flex-col items-center gap-4">
                  <span
                    className="material-symbols-outlined text-secondary"
                    style={{ fontSize: 72, fontVariationSettings: "'FILL' 1" }}
                  >
                    assignment_late
                  </span>
                  <div className="flex gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="w-3 h-3 rounded-full bg-amber-300" />
                    <span className="w-3 h-3 rounded-full bg-secondary" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 max-w-lg mx-auto">
            <h2 className="font-headline text-4xl font-bold text-primary">
              Oops! This task seems to have vanished.
            </h2>
            <p className="text-primary/60 text-lg leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
            <Link
              href="/"
              className="px-8 py-4 bg-primary text-white rounded-lg font-semibold text-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">home</span>
              Back to Home
            </Link>
            <Link
              href="/support"
              className="px-8 py-4 text-primary font-semibold text-lg underline decoration-secondary underline-offset-8 hover:decoration-primary transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">
                contact_support
              </span>
              Contact Support
            </Link>
          </div>

          <div className="pt-8 flex justify-center items-center gap-8 opacity-40">
            <div className="h-px w-16 bg-primary/40" />
            <span className="font-label text-xs uppercase tracking-[0.2em]">
              Error Reference: ARCH-404-TH
            </span>
            <div className="h-px w-16 bg-primary/40" />
          </div>
        </div>
      </main>

      <footer className="w-full py-10 px-8 bg-[#FFF9E5] border-t border-primary/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary/40">
            © 2024 TaskHub. The Editorial Artisan.
          </p>
          <div className="flex gap-6">
            {["About", "FAQ", "Terms", "Privacy"].map((l) => (
              <Link
                key={l}
                href={`/${l.toLowerCase()}`}
                className="text-sm text-primary/50 hover:text-primary underline decoration-secondary underline-offset-4 transition-colors"
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
