import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <p className="w-[25rem] max-w-full rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-center text-xs text-primary md:text-sm">
        This app is exclusively for General Practitioners (Doctors) practicing
        in India.
      </p>
      <div className="w-[25rem] max-w-full">
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
