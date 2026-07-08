"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ClipboardList,
  Users,
  Wallet,
  Pill,
  BellRing,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Daily Case Register",
    description:
      "Quick entry system designed as per Income Tax requirements, with easy Form 25 export.",
  },
  {
    icon: Users,
    title: "Complete Patient Records",
    description:
      "History, vitals, clinical notes, allergies, and documents in one place.",
  },
  {
    icon: Wallet,
    title: "Pending Dues Tracking",
    description:
      "Know exactly how much is due from each patient or family at a glance.",
  },
  {
    icon: Pill,
    title: "Smart Medicine Quick Picker",
    description: "Fast medicine selection with potencies, built for daily use.",
  },
  {
    icon: BellRing,
    title: "Automatic Reminders",
    description: "Next-visit reminders and pending-dues nudges, sent for you.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image
              src="/icon.svg"
              alt="ClinikNote"
              width={32}
              height={32}
              className="rounded-md"
              priority
              unoptimized
            />
            <span className="text-lg font-semibold tracking-tight">
              ClinikNote
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center justify-center">
              <Image
                src="/icon.svg"
                alt="ClinikNote icon"
                width={88}
                height={88}
                className="rounded-2xl shadow-sm"
                priority
                unoptimized
              />
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Simple and smart digital register for doctors
            </h1>
            <p className="mt-5 text-balance text-lg text-muted-foreground sm:text-xl">
              Daily practice records, patient history, and easy IT compliance —
              built for solo practitioners.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Get started — start your trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="rounded-md border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t bg-background">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything your clinic needs, nothing it doesn&rsquo;t
              </h2>
              <p className="mt-3 text-muted-foreground">
                Built around how a small practice actually works day to day.
              </p>
            </div>

            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="rounded-xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Built for
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Solo practitioners running small clinics
            </h2>
            <p className="mt-4 text-balance text-muted-foreground sm:text-lg">
              Especially Homeopathic and Ayurvedic doctors who want a clean,
              compliant digital register — without the bloat of hospital
              software.
            </p>
            <div className="mt-8">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Start your trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Image
              src="/icon.svg"
              alt=""
              width={20}
              height={20}
              className="rounded"
              unoptimized
            />
            <span>ClinikNote</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/disclaimer" className="hover:text-foreground">
              Disclaimer
            </Link>
          </nav>
          <p>
            &copy; {new Date().getFullYear()} ClinikNote. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
