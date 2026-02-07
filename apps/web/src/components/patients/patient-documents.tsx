import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Archive,
  Loader2,
  Upload,
  File,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadDocumentDialog } from "./upload-document-dialog";

const CATEGORY_LABELS: Record<string, string> = {
  lab_report: "Lab Report",
  imaging: "Imaging",
  referral_letter: "Referral",
  prescription: "Prescription",
  consent_form: "Consent",
  insurance: "Insurance",
  discharge_summary: "Discharge",
  other: "Other",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PatientDocuments({ patientId }: { patientId: string }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    trpc.document.list.queryOptions({
      patientId,
      page,
      limit: 20,
    }),
  );

  const archiveMutation = useMutation({
    mutationFn: (id: string) => trpcClient.document.archive.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["document"]] });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  async function handleDownload(id: string) {
    const result = await trpcClient.document.getDownloadUrl.query({ id });
    if (result?.url) {
      window.open(result.url, "_blank");
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="font-semibold">Documents</h3>
          <p className="text-sm text-muted-foreground">
            {total} document{total !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="mb-3 h-12 w-12 opacity-40" />
          <p className="text-lg font-medium">No documents yet</p>
          <p className="mb-4 text-sm">
            Upload lab reports, imaging, referrals, and more
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {items.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <File className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </Badge>
                    <span>{formatFileSize(doc.sizeBytes)}</span>
                    <span>{formatDate(doc.createdAt)}</span>
                    {doc.status === "archived" && (
                      <Badge variant="secondary">Archived</Badge>
                    )}
                  </div>
                  {doc.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doc.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                {doc.status === "active" && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(doc.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => archiveMutation.mutate(doc.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t p-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        patientId={patientId}
      />
    </div>
  );
}
