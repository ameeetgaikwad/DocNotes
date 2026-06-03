"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MoreHorizontal,
  ClipboardList,
  FileText,
  Settings,
  LogOut,
  X,
  ShoppingCart,
  BellRing,
  Pill,
  Archive,
} from "lucide-react";
import { DailyCaseRegisterIcon } from "@/components/icons/daily-case-register";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const TABS: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/daily-register", label: "Register", icon: DailyCaseRegisterIcon },
  { to: "/schedule", label: "Schedule", icon: Calendar },
];

const MORE_ITEMS: NavItem[] = [
  {
    to: "/purchase-list",
    label: "Purchase List of Medicine",
    icon: ShoppingCart,
  },
  {
    to: "/homeopathic-medicine",
    label: "Homeopathic Medicine",
    icon: Pill,
  },
  { to: "/reminders", label: "Reminders", icon: BellRing },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/patients/archived", label: "Recently Deleted", icon: Archive },
  { to: "/settings", label: "Settings", icon: Settings },
];

const MORE_PATHS = MORE_ITEMS.map((i) => i.to);

function isActivePath(currentPath: string, to: string): boolean {
  if (to === "/dashboard") return currentPath === "/dashboard";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

export function MobileBottomNav() {
  const currentPath = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  const moreActive = MORE_PATHS.some((p) => isActivePath(currentPath, p));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="grid grid-cols-5">
          {TABS.map((item) => {
            const active = isActivePath(currentPath, item.to);
            return (
              <li key={item.to}>
                <Link
                  href={item.to}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
                  )}
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-xl p-1.5 transition",
                      active ? "bg-primary/10" : "",
                    )}
                  >
                    <item.icon
                      className={
                        item.to === "/daily-register"
                          ? "h-7 w-7"
                          : "h-[22px] w-[22px]"
                      }
                      strokeWidth={active ? 2.4 : 2}
                    />
                  </span>
                  <span
                    className={
                      item.to === "/daily-register"
                        ? "font-bold"
                        : active
                          ? "font-semibold"
                          : undefined
                    }
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={cn(
                "relative flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
                moreActive || moreOpen
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {(moreActive || moreOpen) && (
                <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
              )}
              <span
                className={cn(
                  "flex items-center justify-center rounded-xl p-1.5 transition",
                  moreActive || moreOpen ? "bg-primary/10" : "",
                )}
              >
                <MoreHorizontal
                  className="h-[22px] w-[22px]"
                  strokeWidth={moreActive || moreOpen ? 2.4 : 2}
                />
              </span>
              <span
                className={moreActive || moreOpen ? "font-semibold" : undefined}
              >
                More
              </span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-background pb-2 shadow-2xl md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-auto mb-2 mt-2 h-1.5 w-10 rounded-full bg-muted" />
            <div className="flex items-center justify-between px-4 pb-2">
              <p className="text-sm font-medium text-muted-foreground">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="px-2 pb-2">
              {MORE_ITEMS.map((item) => {
                const active = isActivePath(currentPath, item.to);
                return (
                  <li key={item.to}>
                    <Link
                      href={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-base",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    void signOut({ redirectUrl: "/auth/login" });
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-base text-foreground hover:bg-muted"
                >
                  <LogOut className="h-5 w-5 text-muted-foreground" />
                  Sign out
                </button>
              </li>
            </ul>
            {user && (
              <div className="border-t border-border px-4 py-3">
                <p className="truncate text-sm font-medium">
                  {user.fullName ??
                    user.primaryEmailAddress?.emailAddress ??
                    ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.primaryEmailAddress?.emailAddress ?? ""}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
