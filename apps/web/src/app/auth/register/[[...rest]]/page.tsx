import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignUp
        path="/auth/register"
        routing="path"
        signInUrl="/auth/login"
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
