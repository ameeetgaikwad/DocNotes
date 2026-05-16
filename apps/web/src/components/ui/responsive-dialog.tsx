import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Mobile-first dialog: renders as a bottom sheet on phone-sized screens
 * (slide up from bottom, full width, rounded top corners, safe-area-bottom
 * padding, drag handle) and as a centered modal at md+. Same Radix Dialog
 * primitive underneath so accessibility behaviour is unchanged.
 *
 * Drop-in replacement for `Dialog` from `./dialog.tsx`. Header / Footer /
 * Title / Description sub-components mirror the existing names.
 */
const ResponsiveDialog = DialogPrimitive.Root;
const ResponsiveDialogTrigger = DialogPrimitive.Trigger;
const ResponsiveDialogPortal = DialogPrimitive.Portal;
const ResponsiveDialogClose = DialogPrimitive.Close;

const ResponsiveDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
ResponsiveDialogOverlay.displayName = "ResponsiveDialogOverlay";

const ResponsiveDialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <ResponsiveDialogPortal>
    <ResponsiveDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Shared
        "fixed z-50 grid gap-4 border bg-background shadow-lg duration-200",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        // Mobile (default): bottom sheet
        "inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border-x-0 border-b-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        // Desktop (md+): centered modal
        "md:inset-x-auto md:bottom-auto md:left-[50%] md:top-[50%] md:max-h-none md:w-full md:max-w-lg md:translate-x-[-50%] md:translate-y-[-50%] md:overflow-visible md:rounded-lg md:border md:px-6 md:pb-6 md:pt-6",
        "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
        "md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%]",
        "md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]",
        className,
      )}
      {...props}
    >
      {/* Drag handle (mobile only — purely visual, gesture-to-dismiss is
          deferred until we wire up the gesture lib in Phase 3). */}
      <div
        aria-hidden
        className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-muted md:hidden"
      />
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground md:right-4 md:top-4">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </ResponsiveDialogPortal>
));
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

const ResponsiveDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-left sm:text-left",
      className,
    )}
    {...props}
  />
);
ResponsiveDialogHeader.displayName = "ResponsiveDialogHeader";

const ResponsiveDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0",
      className,
    )}
    {...props}
  />
);
ResponsiveDialogFooter.displayName = "ResponsiveDialogFooter";

const ResponsiveDialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

const ResponsiveDialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

export {
  ResponsiveDialog,
  ResponsiveDialogPortal,
  ResponsiveDialogOverlay,
  ResponsiveDialogClose,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
