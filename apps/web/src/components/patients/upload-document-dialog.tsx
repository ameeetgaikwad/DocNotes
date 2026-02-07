import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { trpcClient } from "@/lib/trpc";
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
          mimeType: file.type,
          sizeBytes: file.size,
          notes: notes || null,
        });

      // Step 2: Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
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
          <div className="space-y-4">
            <div>
              <Label>File</Label>
              <div
                className="mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 hover:border-primary/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
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
              <Label htmlFor="doc-notes">Notes (optional)</Label>
              <Textarea
                id="doc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this document"
                rows={2}
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
