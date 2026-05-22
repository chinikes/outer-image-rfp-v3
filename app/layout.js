import "./globals.css";
import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Outer Image — RFP Portal",
  description: "AI-powered RFP proposal automation system with multi-file support",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Navigation Bar */}
        <nav className="flex items-center justify-between px-8 h-[60px] bg-black border-b border-neutral-800">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 no-underline">
              <img
                src="/logo.svg"
                alt="Outer Image"
                width={120}
                height={40}
                className="h-9 w-auto"
              />
              <span className="text-neutral-500 text-[11px] font-medium uppercase tracking-[0.15em]">
                RFP Portal
              </span>
            </Link>

            {/* Nav Links */}
            <div className="flex gap-1">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/5 transition-all no-underline"
              >
                Upload
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/5 transition-all no-underline"
              >
                Dashboard
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/5 transition-all no-underline"
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
