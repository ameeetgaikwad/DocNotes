import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <p className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-center text-xs text-primary md:text-sm">
          This app is exclusively for General Practitioners (Doctors) practicing
          in India.
        </p>
        <SignIn
          path="/auth/login"
          routing="path"
          signUpUrl="/auth/register"
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
