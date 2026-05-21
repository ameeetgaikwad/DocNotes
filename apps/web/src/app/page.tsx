"use client";

import { useAuth } from "@clerk/nextjs";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/Landing";

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Dashboard /> : <Landing />;
}
