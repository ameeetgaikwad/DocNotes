import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { trpcClient } from "./trpc";
import { getToken, setToken, clearToken } from "./auth";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    trpcClient.auth.me
      .query()
      .then((u) => {
        if (u) {
          setUser(u);
        } else {
          clearToken();
        }
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await trpcClient.auth.login.mutate({ email, password });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await trpcClient.auth.register.mutate({
        email,
        password,
        name,
      });
      setToken(result.token);
      setUser(result.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await trpcClient.auth.logout.mutate();
    } catch {
      // Ignore errors on logout
    }
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
