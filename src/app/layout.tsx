import "./globals.css";
import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "PIXELock", description: "Private, timed image reveal" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="w-full border-b" style={{ backgroundColor: "#60CEF4" }}>
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/pixelock_logo_text.png" alt="PIXELock" width={160} height={28} />
            </Link>
            <nav className="flex items-center gap-6 text-[color:#05024E]">
              <a href="/#faq" className="font-medium">FAQ</a>
              <a href="/#donate" className="font-medium">Donate</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
