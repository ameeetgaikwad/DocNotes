"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  Settings,
  Search,
  FileText,
  ShoppingCart,
  BellRing,
  Wallet,
  Pill,
} from "lucide-react";
import { DailyCaseRegisterIcon } from "@/components/icons/daily-case-register";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  {
    to: "/daily-register",
    label: "Daily Case Register",
    icon: DailyCaseRegisterIcon,
  },
  { to: "/purchase-list", label: "Purchase List", icon: ShoppingCart },
  { to: "/clinic-expenses", label: "Clinic Expenses", icon: Wallet },
  { to: "/homeopathic-medicine", label: "Medicines", icon: Pill },
  { to: "/reminders", label: "Reminders", icon: BellRing },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

const bottomItems = [
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const currentPath = usePathname() ?? "";
  const { user } = useUser();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">
            ClinikNote
          </span>
        </div>
      </div>

      <div className="px-3 py-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-auto pointer-events-none hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              item.to === "/dashboard"
                ? currentPath === "/dashboard"
                : currentPath.startsWith(item.to);
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="px-3 py-2">
        {bottomItems.map((item) => {
          const isActive = currentPath.startsWith(item.to);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {user && (
        <>
          <Separator />
          <div className="flex items-center gap-3 px-4 py-3">
            <UserButton />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.primaryEmailAddress?.emailAddress ?? ""}
              </p>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
