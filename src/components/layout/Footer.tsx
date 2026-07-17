import { MdPublic } from "react-icons/md";
import Link from "next/link";
import Logo from "@/components/ui/Logo";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-primary/10 py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
          <div className="space-y-4">
            <Logo size={32} />
            <p className="text-sm font-light text-primary/60 leading-relaxed">
              Connecting global talent with digital precision. Redefining how
              the world gets micro-tasks done.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-primary mb-4 text-sm uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/#how-it-works"
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/tasks"
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  Browse Tasks
                </Link>
              </li>
              <li>
                <Link
                  href="/register?role=buyer"
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  Post a Task
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-primary mb-4 text-sm uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-primary mb-4 text-sm uppercase tracking-wider">
              Contact
            </h4>
            <p className="text-sm text-primary/60">hello@taskhub.dev</p>
            <div className="mt-6">
              <h4 className="font-bold text-primary mb-3 text-sm uppercase tracking-wider">
                Mobile App
              </h4>
              <a
                href="https://expo.dev/artifacts/eas/Vu_A6GdruDXbMNESpaXafpFsgY5VWmHijIyHlzoLswg.apk"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                download
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.74 3.15.8 1.2-.24 2.35-.93 3.64-.84 1.54.12 2.7.72 3.47 1.84-3.18 1.9-2.43 5.98.74 7.14-.59 1.56-1.35 3.1-2 3.94zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Download for Android
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-primary/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary/40">
            © {new Date().getFullYear()} TaskHub. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a
              href="#"
              className="w-9 h-9 rounded-full border border-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all"
            >
              <MdPublic className="text-base text-secondary" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
