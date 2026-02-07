import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  Lock,
  FileText,
  Download,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import { downloadBase64File } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/share/$token")({
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  const accessMutation = useMutation({
    mutationFn: (pwd: string | undefined = undefined) =>
      trpcClient.share.access.mutate({
        token,
        password: pwd ?? undefined,
      }),
    onSuccess: (data) => {
      if ("requiresPassword" in data && data.requiresPassword) {
        setNeedsPassword(true);
        return;
      }

      if ("type" in data) {
        if (data.type === "pdf" && "base64" in data) {
          downloadBase64File(data.base64, data.filename, "application/pdf");
        } else if (data.type === "redirect" && "url" in data) {
          window.location.href = data.url;
        }
      }
    },
  });

  const errorMessage = accessMutation.error?.message ?? "";
  const isExpired = errorMessage.includes("expired");
  const isRevoked = errorMessage.includes("revoked");
  const isLimitReached = errorMessage.includes("access limit");
  const isNotFound = errorMessage.includes("not found");
  const isWrongPassword = errorMessage.includes("Incorrect password");

  // Success state — PDF was downloaded
  const successData = accessMutation.data;
  const isSuccess =
    successData &&
    "type" in successData &&
    !("requiresPassword" in successData && successData.requiresPassword);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">DocNotes</h1>
            <p className="text-sm text-muted-foreground">
              Shared Medical Records
            </p>
          </div>

          {/* Error states */}
          {accessMutation.isError &&
            (isExpired || isRevoked || isLimitReached || isNotFound) && (
              <div className="flex flex-col items-center gap-3 text-center">
                <ShieldAlert className="h-10 w-10 text-destructive/60" />
                <p className="font-medium">
                  {isExpired && "This link has expired"}
                  {isRevoked && "This link has been revoked"}
                  {isLimitReached && "This link has reached its access limit"}
                  {isNotFound && "Share link not found"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Please contact the provider for a new link.
                </p>
              </div>
            )}

          {/* Password prompt */}
          {needsPassword && !isSuccess && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  This link is password-protected. Enter the password to access
                  the records.
                </p>
              </div>

              <div>
                <Label htmlFor="access-password">Password</Label>
                <Input
                  id="access-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password) {
                      accessMutation.mutate(password);
                    }
                  }}
                />
                {isWrongPassword && (
                  <p className="mt-1 text-sm text-destructive">
                    Incorrect password. Please try again.
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => accessMutation.mutate(password)}
                disabled={!password || accessMutation.isPending}
              >
                {accessMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Access Records"
                )}
              </Button>
            </div>
          )}

          {/* Success state */}
          {isSuccess && (
            <div className="flex flex-col items-center gap-3 text-center">
              <Download className="h-10 w-10 text-green-500" />
              <p className="font-medium">Download started</p>
              <p className="text-sm text-muted-foreground">
                Your file should begin downloading shortly.
              </p>
              <Button
                variant="outline"
                onClick={() => accessMutation.mutate(password || undefined)}
              >
                Download Again
              </Button>
            </div>
          )}

          {/* Initial state — access without password */}
          {!needsPassword && !accessMutation.isError && !isSuccess && (
            <div className="flex flex-col items-center gap-4">
              {accessMutation.isPending ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Loading shared records...
                  </p>
                </>
              ) : (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    A healthcare provider has shared medical records with you.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => accessMutation.mutate(undefined)}
                  >
                    <Download className="h-4 w-4" />
                    Access Records
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Generic error */}
          {accessMutation.isError &&
            !isExpired &&
            !isRevoked &&
            !isLimitReached &&
            !isNotFound &&
            !isWrongPassword && (
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircle className="h-10 w-10 text-destructive/60" />
                <p className="font-medium">Something went wrong</p>
                <p className="text-sm text-muted-foreground">
                  {errorMessage || "Please try again later."}
                </p>
                <Button
                  variant="outline"
                  onClick={() => accessMutation.mutate(undefined)}
                >
                  Try Again
                </Button>
              </div>
            )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Shared securely via DocNotes. This link may expire or have limited
          access.
        </p>
      </div>
    </div>
  );
}
