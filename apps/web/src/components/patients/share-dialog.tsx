import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Loader2,
  Link as LinkIcon,
  X,
  Shield,
  Clock,
  Eye,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: "patient_summary" | "medical_record" | "document";
  resourceId: string;
  resourceLabel: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceLabel,
}: Props) {
  const [password, setPassword] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("72");
  const [maxAccesses, setMaxAccesses] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: existingLinks, isLoading: linksLoading } = useQuery({
    ...trpc.share.listByResource.queryOptions({
      resourceType,
      resourceId,
    }),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      trpcClient.share.create.mutate({
        resourceType,
        resourceId,
        expiresInHours: Number(expiresInHours),
        password: password || undefined,
        maxAccesses: maxAccesses ? Number(maxAccesses) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["share"]] });
      setPassword("");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => trpcClient.share.revoke.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["share"]] });
    },
  });

  async function copyToClipboard(url: string) {
    const webUrl = import.meta.env.VITE_WEB_URL || "http://localhost:3000";
    const token = url.startsWith("http") ? url : `${webUrl}/share/${url}`;
    await navigator.clipboard.writeText(token);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  const activeLinks =
    existingLinks?.filter(
      (l) => !l.isRevoked && new Date(l.expiresAt) > new Date(),
    ) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Records</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Create a secure, expiring link to share {resourceLabel} with
          specialists.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="share-expiry">Expires in</Label>
              <Select
                id="share-expiry"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(e.target.value)}
              >
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">1 week</option>
                <option value="720">30 days</option>
              </Select>
            </div>

            <div>
              <Label>Max accesses (optional)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                placeholder="Unlimited"
                value={maxAccesses}
                onChange={(e) => setMaxAccesses(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="share-password">
              Password protection (optional)
            </Label>
            <Input
              id="share-password"
              type="password"
              placeholder="Leave empty for no password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4" />
                Create Share Link
              </>
            )}
          </Button>

          {createMutation.data && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Share link created
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={createMutation.data.url}
                  className="text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(createMutation.data!.url)}
                >
                  {copiedUrl === createMutation.data.url ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {activeLinks.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="mb-3 text-sm font-medium">Active Share Links</h4>
            {linksLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="space-y-2">
                {activeLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Expires{" "}
                        {new Date(link.expiresAt).toLocaleDateString("en-IN")}
                      </span>
                      <Eye className="h-3 w-3" />
                      <span>
                        {link.accessCount}
                        {link.maxAccesses ? `/${link.maxAccesses}` : ""} views
                      </span>
                      {link.hasPassword && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="mr-1 h-3 w-3" />
                          Protected
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyToClipboard(link.token)}
                      >
                        {copiedUrl === link.token ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => revokeMutation.mutate(link.id)}
                        disabled={revokeMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
