import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignIn
        path="/auth/login"
        routing="path"
        signUpUrl="/auth/register"
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
