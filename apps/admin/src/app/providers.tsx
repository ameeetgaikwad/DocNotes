"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, SignOutButton } from "@clerk/nextjs";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
  useQuery,
} from "@tanstack/react-query";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    function handleUnauthorized(error: unknown) {
      const code = (error as { data?: { code?: string } }).data?.code;
      if (code === "UNAUTHORIZED" && typeof window !== "undefined") {
        window.location.href = "/sign-in";
      }
    }
    return new QueryClient({
      queryCache: new QueryCache({ onError: handleUnauthorized }),
      mutationCache: new MutationCache({ onError: handleUnauthorized }),
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60,
          refetchOnWindowFocus: false,
          retry: (failureCount, error) => {
            const code = (error as { data?: { code?: string } }).data?.code;
            if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return false;
            return failureCount < 3;
          },
        },
      },
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>{children}</Shell>
    </QueryClientProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isAuthPage = pathname.startsWith("/sign-in");

  // adminCheck verifies the signed-in user has role="admin" server-side.
  // Non-admins (typed the URL, copied a link) hit FORBIDDEN and get
  // bounced to a small "not authorized" screen rather than seeing a
  // broken dashboard.
  const adminCheck = useQuery({
    ...trpc.admin.me.queryOptions(),
    enabled: !!(isLoaded && isSignedIn && !isAuthPage),
    retry: false,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (isAuthPage) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, isAuthPage, router]);

  if (isAuthPage) return <>{children}</>;
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (adminCheck.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (adminCheck.error) {
    const code = (adminCheck.error as { data?: { code?: string } }).data?.code;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="max-w-md text-muted-foreground">
          {code === "FORBIDDEN"
            ? "This account doesn't have admin access. Ask Amit to promote your user role."
            : "Could not verify admin access. Please try again."}
        </p>
        <SignOutButton>
          <button className="rounded-md border px-4 py-2 text-sm">
            Sign out
          </button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="text-base font-semibold tracking-tight">
            ClinikNote <span className="text-primary">Admin</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground"
            >
              Overview
            </Link>
            <Link
              href="/doctors"
              className="text-muted-foreground hover:text-foreground"
            >
              Doctors
            </Link>
            <SignOutButton>
              <button className="rounded-md border px-3 py-1.5 text-xs">
                Sign out
              </button>
            </SignOutButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
