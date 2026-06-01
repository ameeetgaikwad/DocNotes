import { SignUp } from "@clerk/nextjs";

// Express consent for Terms of Service + Privacy Policy is handled by
// Clerk's native "Require express consent to legal documents" toggle
// (enabled in the dashboard with URLs pointing at /terms and /privacy).
// Disclaimer acceptance is captured separately at onboarding since
// Clerk's consent feature only supports two legal URL slots.
export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <p className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-center text-xs text-primary md:text-sm">
          This app is exclusively for General Practitioners (Doctors) practicing
          in India.
        </p>
        <SignUp
          path="/auth/register"
          routing="path"
          signInUrl="/auth/login"
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
