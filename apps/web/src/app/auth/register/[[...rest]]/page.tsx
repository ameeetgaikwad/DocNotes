import { SignUp } from "@clerk/nextjs";

// Express consent for Terms of Service + Privacy Policy is handled by
// Clerk's native "Require express consent to legal documents" toggle
// (enabled in the dashboard with URLs pointing at /terms and /privacy).
// Disclaimer acceptance is captured separately at onboarding since
// Clerk's consent feature only supports two legal URL slots.
export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignUp
        path="/auth/register"
        routing="path"
        signInUrl="/auth/login"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
