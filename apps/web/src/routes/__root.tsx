import { useState } from "react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { clearToken } from "@/lib/auth";
import { AppSidebar } from "@/components/AppSidebar";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "DocNotes",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),

  component: RootComponent,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => {
    function handleUnauthorized(error: unknown) {
      const code = (error as { data?: { code?: string } }).data?.code;
      if (code === "UNAUTHORIZED") {
        clearToken();
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
      <AuthProvider>
        <TooltipProvider>
          <AuthenticatedLayout />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();
  const routerState = useRouterState();
  const navigate = useNavigate();
  const isAuthPage = routerState.location.pathname.startsWith("/auth");
  const isPublicPage = routerState.location.pathname.startsWith("/share");

  // While checking auth, show nothing (prevents flash) — except for public pages
  if (isLoading && !isPublicPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Auth pages and public pages get rendered without sidebar
  if (isAuthPage || isPublicPage) {
    return <Outlet />;
  }

  // Not authenticated → redirect to login
  if (!user) {
    // Use effect-free redirect via navigate
    navigate({ to: "/auth/login", replace: true });
    return null;
  }

  // Authenticated → show app shell
  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
