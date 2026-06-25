import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            ClinikNote <span className="text-primary">Admin</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal access only.
          </p>
        </div>
        <SignIn forceRedirectUrl="/" />
      </div>
    </div>
  );
}
