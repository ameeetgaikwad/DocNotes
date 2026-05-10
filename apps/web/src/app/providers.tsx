"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";

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
  const isAuthPage = pathname.startsWith("/auth");
  const isPublicPage = pathname.startsWith("/share");

  if (!isLoaded && !isPublicPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthPage || isPublicPage) {
    return <>{children}</>;
  }

  if (!isSignedIn) {
    // Middleware will have already redirected, but guard the render path too.
    return null;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
