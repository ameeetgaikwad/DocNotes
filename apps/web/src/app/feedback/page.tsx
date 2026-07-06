"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Compress an uploaded image to a JPEG data URL bounded by
// maxDimension on the longer edge and a target quality. Doctors often
// hand phones to the reception with 12MP camera photos — sending them
// raw would blow the payload cap. 1200px + q=0.7 lands ~200 KB for
// most UI screenshots and is more than legible.
async function compressImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.7,
): Promise<string> {
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
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available.");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

export default function FeedbackPage() {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotBytes, setScreenshotBytes] = useState<number>(0);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submitMutation = useMutation({
    mutationFn: () =>
      trpcClient.feedback.submit.mutate({
        rating,
        message: message.trim(),
        screenshotDataUrl: screenshot ?? undefined,
        path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
      setRating(0);
      setMessage("");
      setScreenshot(null);
      setScreenshotBytes(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSubmitError(null);
      window.setTimeout(() => setSubmitted(false), 5000);
    },
    onError: (e) => setSubmitError(e.message),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setScreenshotError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScreenshotError("Please choose an image file.");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await compressImageFile(file);
      setScreenshot(dataUrl);
      setScreenshotBytes(dataUrl.length);
    } catch (err) {
      setScreenshotError(
        err instanceof Error ? err.message : "Could not process the image.",
      );
    }
  }

  function clearScreenshot() {
    setScreenshot(null);
    setScreenshotBytes(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canSubmit =
    rating >= 1 &&
    rating <= 5 &&
    message.trim().length > 0 &&
    !submitMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Send Feedback</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Tell us what&apos;s working, what&apos;s broken, or what you wish the
        app did. Your feedback goes straight to the developer.
      </p>

      <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
        {/* Star rating */}
        <div>
          <p className="mb-2 text-sm font-medium">
            How&apos;s your experience?{" "}
            <span className="text-destructive">*</span>
          </p>
          <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = (hoverRating || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  className="rounded-md p-1 hover:bg-accent"
                >
                  <Star
                    className={
                      filled
                        ? "h-8 w-8 fill-amber-400 text-amber-400"
                        : "h-8 w-8 text-muted-foreground"
                    }
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label htmlFor="fb-msg" className="text-sm font-medium">
            Your feedback <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="fb-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What did you like? What broke? What could be better?"
            rows={5}
            maxLength={2000}
          />
          <p className="text-[11px] text-muted-foreground">
            {message.length} / 2000
          </p>
        </div>

        {/* Screenshot */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Screenshot (optional)</p>
          {screenshot ? (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-2">
              <img
                src={screenshot}
                alt="Screenshot preview"
                className="h-24 w-24 rounded-md border object-cover"
              />
              <div className="flex-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Attached</p>
                <p>{Math.round(screenshotBytes / 1024)} KB</p>
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
              <ImageIcon className="h-4 w-4" />
              <span>Attach an image</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          )}
          {screenshotError && (
            <p className="text-xs text-destructive">{screenshotError}</p>
          )}
        </div>

        {submitError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {submitted && (
          <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success-foreground">
            <Check className="mt-0.5 h-4 w-4 text-success" />
            <div>
              <p className="font-medium">Thanks! Your feedback was sent.</p>
              <p className="text-xs text-muted-foreground">
                We read every message. Expect a reply soon if you asked a
                question.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send Feedback
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
