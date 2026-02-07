import { trpcClient } from "./trpc";

const TOKEN_KEY = "docnotes_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    return await trpcClient.auth.me.query();
  } catch {
    clearToken();
    return null;
  }
}
