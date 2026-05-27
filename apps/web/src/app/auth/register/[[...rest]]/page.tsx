"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

// Sign-up is gated behind an explicit "I agree" tick covering Terms,
// Privacy, and Disclaimer. The checkbox state is persisted to
// localStorage so Clerk's internal step transitions (email →
// verification → completion, all under this catch-all route) don't
// reset it and re-block the form mid-flow.
const STORAGE_KEY = "cliniknote.legalConsent";

export default function RegisterPage() {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAgreed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function handleChange(checked: boolean) {
    setAgreed(checked);
    if (typeof window === "undefined") return;
    if (checked) {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 text-sm shadow-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => handleChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
            aria-label="Accept legal terms"
          />
          <span>
            I have read and agree to ClinikNote&apos;s{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Terms of Service
            </Link>
            ,{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Privacy Policy
            </Link>
            , and{" "}
            <Link
              href="/disclaimer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Disclaimer
            </Link>
            .
          </span>
        </label>

        {agreed ? (
          <SignUp
            path="/auth/register"
            routing="path"
            signInUrl="/auth/login"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
          />
        ) : (
          <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Tick the box above to continue with sign-up.
          </div>
        )}
      </div>
    </div>
  );
}
