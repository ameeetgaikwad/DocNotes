"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
  useQuery,
} from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    function handleUnauthorized(error: unknown) {
      const code = (error as { data?: { code?: string } }).data?.code;
      if (code === "UNAUTHORIZED" && typeof window !== "undefined") {
        window.location.href = "/auth/login";
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
            if (code === "UNAUTHORIZED") return false;
            return failureCount < 3;
          },
        },
      },
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Shell>{children}</Shell>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isAuthPage = pathname.startsWith("/auth");
  const isPublicPage =
    pathname.startsWith("/share") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/disclaimer";
  const isHomePage = pathname === "/";
  const isOnboardingPage = pathname === "/onboarding";

  const profileQuery = useQuery({
    ...trpc.doctorProfile.me.queryOptions(),
    enabled: !!(
      isLoaded &&
      isSignedIn &&
      !isAuthPage &&
      !isPublicPage &&
      !isHomePage
    ),
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (isAuthPage || isPublicPage) return;
    if (!isSignedIn) {
      // Signed-out users may view the landing page at /; everything else
      // pushes them to login.
      if (isHomePage) return;
      router.replace("/auth/login");
      return;
    }
    // Signed-in user landed on the public landing route — bounce them to
    // the dashboard. Background redirect; Landing keeps rendering in the
    // meantime so there's no spinner flash.
    if (isHomePage) {
      router.replace("/dashboard");
      return;
    }
    if (profileQuery.isLoading) return;
    if (profileQuery.data === null && !isOnboardingPage) {
      router.replace("/onboarding");
    } else if (profileQuery.data && isOnboardingPage) {
      router.replace("/dashboard");
    }
  }, [
    isLoaded,
    isSignedIn,
    isAuthPage,
    isPublicPage,
    isHomePage,
    isOnboardingPage,
    profileQuery.isLoading,
    profileQuery.data,
    router,
  ]);

  // Marketing surfaces (landing + legal pages + auth + share) render their
  // own content immediately, with no spinner gating on Clerk init. Anything
  // else (dashboard + tools) waits for auth resolution before deciding what
  // to render.
  const isMarketingSurface = isAuthPage || isPublicPage || isHomePage;

  if (!isLoaded && !isMarketingSurface) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthPage || isPublicPage) {
    return <>{children}</>;
  }

  if (isHomePage) {
    // Both signed-out (final state, render Landing) and signed-in
    // (transient, redirect to /dashboard in flight) get Landing here. No
    // spinner for either.
    return <>{children}</>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isOnboardingPage) {
    return <>{children}</>;
  }

  if (profileQuery.isLoading || profileQuery.data === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
