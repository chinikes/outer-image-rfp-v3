import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Ver 3.0 — RFP Portal",
  description: "AI-powered RFP proposal automation system with multi-file support",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Navigation Bar */}
        <nav className="flex items-center justify-between px-8 h-[60px] bg-brand-navy border-b border-brand-navy-light">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal-accent flex items-center justify-center">
                <span className="text-white font-extrabold text-[15px] tracking-tighter">
                  OI
                </span>
              </div>
              <span className="text-white font-semibold text-base tracking-wide">
                Ver 3.0
              </span>
              <span className="text-brand-teal-accent text-xs font-medium opacity-80 -ml-1">
                RFP Portal
              </span>
            </Link>

            {/* Nav Links */}
            <div className="flex gap-1">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-brand-teal-accent hover:bg-white/5 transition-all no-underline"
              >
                Upload
              </Link>
               <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-brand-teal-accent hover:bg-white/5 transition-all no-underline"
              >
                Dashboard
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-brand-teal-accent hover:bg-white/5 transition-all no-underline"
              >
                Admin
              </Link>
            </div>
          </div>

          {/* Spacer */}
          <div></div>
        </nav>

        {/* Page Content */}
        <main>{children}</main>
      </body>
    </html>
  );
}
