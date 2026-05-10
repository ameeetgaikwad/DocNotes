import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import type { AppRouter } from "@docnotes/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getClerkSessionToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const clerk = (
    window as unknown as {
      Clerk?: { session?: { getToken: () => Promise<string | null> } };
    }
  ).Clerk;
  if (!clerk?.session) return null;
  return clerk.session.getToken();
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      transformer: superjson,
      async headers() {
        const token = await getClerkSessionToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient: null!,
});
