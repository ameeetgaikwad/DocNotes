import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

// Header + footer chrome for the public /blogs pages. Mirrors
// LegalLayout so marketing surfaces feel like one site.
export function BlogShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const width = wide ? "max-w-5xl" : "max-w-3xl";
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div
          className={`mx-auto flex w-full ${width} items-center justify-between px-4 py-4 sm:px-6`}
        >
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon.svg"
              alt="ClinikNote"
              width={28}
              height={28}
              className="rounded-md"
              unoptimized
            />
            <span className="text-base font-semibold">ClinikNote</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/blogs"
              className="text-muted-foreground hover:text-foreground"
            >
              Blog
            </Link>
            <Link
              href="/auth/login"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className={`mx-auto w-full ${width} flex-1 px-4 py-10 sm:px-6`}>
        {children}
      </main>

      <footer className="border-t">
        <div
          className={`mx-auto flex w-full ${width} flex-wrap gap-x-4 gap-y-2 px-4 py-6 text-sm text-muted-foreground sm:px-6`}
        >
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/retention" className="hover:text-foreground">
            Data Retention
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/disclaimer" className="hover:text-foreground">
            Disclaimer
          </Link>
        </div>
      </footer>
    </div>
  );
}
