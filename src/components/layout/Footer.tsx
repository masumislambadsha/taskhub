import { MdPublic } from 'react-icons/md';
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
