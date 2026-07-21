import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Manoj msg 2369: shrink phone-camera photos before they leave the
// device so the R2 upload and the per-user storage cap both stay
// friendly. 1600 px on the longer edge + JPEG q=0.75 turns a 4 MB
// phone photo into ~250-500 KB with no visible quality loss for lab
// reports / prescription scans. PDFs and Word docs pass through
// unchanged (call site guards on file.type).
async function compressImageForUpload(
  file: File,
  maxDimension = 1600,
  quality = 0.75,
): Promise<File> {
  const rawUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read the image."));
      el.src = rawUrl;
    });
    let { width, height } = img;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    // If the image is already small AND uses a well-compressed
    // format, skip re-encoding — no point paying quality for nothing.
    if (
      scale === 1 &&
      (file.type === "image/jpeg" || file.type === "image/webp")
    ) {
      return file;
    }
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    // Rename to .jpg so the extension matches the mime type.
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // On any error, fall back to the raw file — better to upload a
    // big image than block the doctor.
    return file;
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

const CATEGORIES = [
  { value: "lab_report", label: "Lab Report" },
  { value: "imaging", label: "Imaging" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "prescription", label: "Prescription" },
  { value: "consent_form", label: "Consent Form" },
  { value: "insurance", label: "Insurance" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "other", label: "Other" },
];

type UploadStep = "select" | "uploading" | "success" | "error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  medicalRecordId?: string;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  patientId,
  medicalRecordId,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<UploadStep>("select");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      setStep("uploading");

      // Manoj msg 2369: compress images before requesting the upload
      // URL so both the wire request and the R2 bill are smaller. PDFs
      // and Word docs pass through unchanged — see technical note in
      // that message thread.
      const payload = file.type.startsWith("image/")
        ? await compressImageForUpload(file)
        : file;

      // Step 1: Request upload URL
      const { documentId, uploadUrl } =
        await trpcClient.document.requestUpload.mutate({
          patientId,
          medicalRecordId: medicalRecordId ?? null,
          name: name || file.name,
          category: category as
            | "lab_report"
            | "imaging"
            | "referral_letter"
            | "prescription"
            | "consent_form"
            | "insurance"
            | "discharge_summary"
            | "other",
          mimeType: payload.type,
          sizeBytes: payload.size,
          notes: notes || null,
        });

      // Step 2: Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: payload,
        headers: {
          "Content-Type": payload.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      // Step 3: Confirm upload
      await trpcClient.document.confirmUpload.mutate({ id: documentId });

      return { documentId };
    },
    onSuccess: () => {
      setStep("success");
      // Bust both the document list and the usage query so the
      // progress bar reflects the new upload right away.
      queryClient.invalidateQueries({ queryKey: [["document"]] });
    },
    onError: (error: Error) => {
      setStep("error");
      setErrorMessage(error.message);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setErrorMessage(
        "File type not allowed. Please upload PDF, JPEG, PNG, WebP, or Word documents.",
      );
      setStep("error");
      return;
    }

    if (selected.size > MAX_SIZE) {
      setErrorMessage("File size exceeds 10MB limit.");
      setStep("error");
      return;
    }

    setFile(selected);
    if (!name) {
      setName(selected.name.replace(/\.[^.]+$/, ""));
    }
    setStep("select");
    setErrorMessage("");
  }

  function handleClose() {
    setFile(null);
    setName("");
    setCategory("other");
    setNotes("");
    setStep("select");
    setErrorMessage("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        {step === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-medium">Document uploaded successfully</p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : step === "error" && !file ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-center text-sm text-destructive">
              {errorMessage}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setStep("select");
                setErrorMessage("");
              }}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>File</Label>
              <div
                className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2 hover:border-primary/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
                {file ? (
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {file.name}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to select a file (max 10MB)
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ALLOWED_TYPES.join(",")}
                  onChange={handleFileChange}
                />
              </div>
              {/* Manoj msg 2282: Samsung's file picker labels its
                  "Files" intent as "Photos and videos" and hides
                  everything else, so it's easy to think we don't
                  accept PDFs. Call out the supported types so the
                  doctor knows to tap "Photos and videos" for PDFs. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Supports PDF, JPG, PNG, WebP, Word · pick a PDF from your
                phone&apos;s Files (Samsung labels it &quot;Photos and
                videos&quot;)
              </p>
            </div>

            <div>
              <Label htmlFor="doc-name">Name</Label>
              <Input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Document name"
              />
            </div>

            <div>
              <Label htmlFor="doc-category">Category</Label>
              <Select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="doc-notes">Notes</Label>
              <Textarea
                id="doc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
              />
            </div>

            {step === "error" && errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!file || !name || step === "uploading"}
              >
                {step === "uploading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
