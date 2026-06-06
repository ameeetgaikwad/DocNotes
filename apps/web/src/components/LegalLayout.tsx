import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function LegalLayout({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
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
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective Date: {effectiveDate}
        </p>

        <article className="prose prose-slate mt-8 max-w-none text-sm leading-relaxed text-foreground dark:prose-invert sm:text-base [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </article>

        <div className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm">
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="text-primary hover:underline">
            Terms
          </Link>
          <Link href="/disclaimer" className="text-primary hover:underline">
            Disclaimer
          </Link>
        </div>
      </main>
    </div>
  );
}
