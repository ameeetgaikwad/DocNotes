import { cn } from "@/lib/utils";

interface MobilePageProps {
  children: React.ReactNode;
  className?: string;
  /**
   * When true (default), pads the top by the iOS standalone safe-area
   * inset so content doesn't sit under the notch when launched from the
   * Home Screen. Set false for pages that need to draw under the status
   * bar (e.g. a full-bleed hero).
   */
  safeAreaTop?: boolean;
}

/**
 * Shared page wrapper for all main routes. Owns the consistent padding,
 * the iOS safe-area inset for standalone PWA launches, and reserves space
 * for the mobile bottom-tab nav. Pair with `PageHeader` for the title row.
 *
 * Desktop layout is unchanged — the wrapper just standardises horizontal
 * padding (`p-4 sm:p-6 md:p-8`) so pages don't reinvent it.
 */
export function MobilePage({
  children,
  className,
  safeAreaTop = true,
}: MobilePageProps) {
  return (
    <div
      className={cn(
        "p-4 sm:p-6 md:p-8",
        // Bottom-nav clearance on mobile so content isn't covered by the
        // 64px tab bar + safe-area-inset-bottom on iPhone X+.
        "pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8",
        safeAreaTop && "pt-[calc(1rem+env(safe-area-inset-top,0px))] md:pt-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
