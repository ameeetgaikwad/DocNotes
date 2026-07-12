import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Loader2, Printer } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { downloadBase64File, printBase64Pdf } from "@/lib/download";
import { todayLocalIsoDate } from "@/lib/format";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientGender: string | null;
}

type Step = "picker" | "food-handler" | "fitness";

// Manoj msg 2119: v1 ships Food Handler; the picker also lists two
// disabled placeholders so the doctor knows which templates are on
// the way and can prompt for their standard text later.
export function MedicalCertificatesDialog({
  open,
  onOpenChange,
  patientId,
  patientGender,
}: Props) {
  const [step, setStep] = useState<Step>("picker");

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Reset when closing so re-opening starts back at the picker.
      setTimeout(() => setStep("picker"), 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "picker" && (
              <button
                type="button"
                onClick={() => setStep("picker")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Back to template list"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {step === "picker"
              ? "Medical Certificates"
              : step === "food-handler"
                ? "Food Handler Fitness Certificate"
                : "Medical Fitness Certificate"}
          </DialogTitle>
        </DialogHeader>

        {step === "picker" ? (
          <TemplatePicker
            onPickFoodHandler={() => setStep("food-handler")}
            onPickFitness={() => setStep("fitness")}
          />
        ) : step === "food-handler" ? (
          <FoodHandlerForm
            patientId={patientId}
            patientGender={patientGender}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <FitnessForm
            patientId={patientId}
            patientGender={patientGender}
            onClose={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplatePicker({
  onPickFoodHandler,
  onPickFitness,
}: {
  onPickFoodHandler: () => void;
  onPickFitness: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Pick a certificate to generate for this patient.
      </p>
      <button
        type="button"
        onClick={onPickFoodHandler}
        className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left hover:bg-accent"
      >
        <FileText className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Medical Fitness — Food Handlers</p>
          <p className="text-xs text-muted-foreground">
            For employees engaged in preparing / handling / serving food.
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={onPickFitness}
        className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left hover:bg-accent"
      >
        <FileText className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Medical Fitness Certificate</p>
          <p className="text-xs text-muted-foreground">
            General fitness — join duties / attend school / hostel admission /
            travel.
          </p>
        </div>
      </button>
      <DisabledTemplateRow
        title="Medical Leave Certificate"
        subtitle="Sick leave / recovery certificate."
      />
    </div>
  );
}

function DisabledTemplateRow({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex w-full cursor-not-allowed items-start gap-3 rounded-lg border bg-muted/30 p-3 opacity-60">
      <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Coming soon
      </span>
    </div>
  );
}

function defaultHonorific(gender: string | null): "Shri" | "Smt." | "" {
  if (!gender) return "";
  const g = gender.toLowerCase();
  if (g.startsWith("m")) return "Shri";
  if (g.startsWith("f")) return "Smt.";
  return "";
}

function FoodHandlerForm({
  patientId,
  patientGender,
  onClose,
}: {
  patientId: string;
  patientGender: string | null;
  onClose: () => void;
}) {
  const profileQuery = useQuery(trpc.doctorProfile.me.queryOptions());
  const doctor = profileQuery.data ?? null;

  const [businessName, setBusinessName] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [employerTouched, setEmployerTouched] = useState(false);
  const [examDate, setExamDate] = useState(todayLocalIsoDate());
  const [place, setPlace] = useState("");
  const [placeTouched, setPlaceTouched] = useState(false);
  const [honorific, setHonorific] = useState<"" | "Shri" | "Smt." | "Miss">(
    defaultHonorific(patientGender),
  );
  const [error, setError] = useState<string | null>(null);

  // Auto-fill Place from doctor's clinic taluka once the profile
  // loads, unless the doctor has already typed something.
  const derivedPlace = useMemo(() => {
    if (!doctor) return "";
    return doctor.taluka || doctor.district || "";
  }, [doctor]);
  useEffect(() => {
    if (!placeTouched && place === "" && derivedPlace) {
      setPlace(derivedPlace);
    }
  }, [derivedPlace, placeTouched, place]);

  // Mirror businessName into employerName until the doctor edits the
  // employer field manually — most restaurants list the business itself
  // as the M/s entity.
  const effectiveEmployer = employerTouched ? employerName : businessName;

  const generateMutation = useMutation({
    mutationFn: (action: "download" | "print") =>
      trpcClient.export.medicalCertificateFoodHandler
        .mutate({
          patientId,
          businessName: businessName.trim(),
          employerName: effectiveEmployer.trim(),
          examDate,
          place: place.trim(),
          honorific,
        })
        .then((result) => ({ ...result, action })),
    onSuccess: (data) => {
      if (data.action === "download") {
        downloadBase64File(data.base64, data.filename, "application/pdf");
      } else {
        printBase64Pdf(data.base64);
      }
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const canGenerate =
    businessName.trim().length > 0 &&
    effectiveEmployer.trim().length > 0 &&
    place.trim().length > 0 &&
    !generateMutation.isPending &&
    !profileQuery.isLoading;

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!doctor) {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-destructive">
          Your doctor profile isn&apos;t set up yet. Fill in Settings → Doctor
          Profile before printing certificates.
        </p>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Patient name, age, sex and your doctor block are pre-filled on the
        printed certificate — fill in the food-establishment details below.
      </p>

      <div className="space-y-2">
        <Label htmlFor="cert-biz">
          Food Business (Hotel / Restaurant){" "}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="cert-biz"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Sai Restaurant"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cert-employer">M/s (Employer)</Label>
        <Input
          id="cert-employer"
          value={effectiveEmployer}
          onChange={(e) => {
            setEmployerName(e.target.value);
            setEmployerTouched(true);
          }}
          placeholder="Defaults to the business name"
        />
        <p className="text-[11px] text-muted-foreground">
          Editable if the employer differs from the food business.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="cert-date">Examination Date</Label>
          <Input
            id="cert-date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cert-place">
            Place <span className="text-destructive">*</span>
          </Label>
          <Input
            id="cert-place"
            value={place}
            onChange={(e) => {
              setPlace(e.target.value);
              setPlaceTouched(true);
            }}
            placeholder={derivedPlace || "Town / village"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Honorific</Label>
        <div className="flex flex-wrap gap-1.5">
          {(["", "Shri", "Smt.", "Miss"] as const).map((h) => (
            <button
              key={h || "blank"}
              type="button"
              onClick={() => setHonorific(h)}
              className={`rounded border px-2.5 py-1 text-xs ${
                honorific === h
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {h || "Shri/Smt./Miss"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Leaving it blank prints the full &quot;Shri/Smt./Miss&quot; string so
          you can circle one in ink.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          onClick={() => generateMutation.mutate("print")}
          disabled={!canGenerate}
        >
          {generateMutation.isPending &&
          generateMutation.variables === "print" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" /> Print
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => generateMutation.mutate("download")}
          disabled={!canGenerate}
        >
          {generateMutation.isPending &&
          generateMutation.variables === "download" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function defaultFitnessHonorific(gender: string | null): "Mr." | "Ms." | "" {
  if (!gender) return "";
  const g = gender.toLowerCase();
  if (g.startsWith("m")) return "Mr.";
  if (g.startsWith("f")) return "Ms.";
  return "";
}

const FITNESS_PURPOSES = [
  "join his duties",
  "join her duties",
  "attend school",
  "attend college",
  "get admission in a hostel",
  "travel abroad",
] as const;

function FitnessForm({
  patientId,
  patientGender,
  onClose,
}: {
  patientId: string;
  patientGender: string | null;
  onClose: () => void;
}) {
  const profileQuery = useQuery(trpc.doctorProfile.me.queryOptions());
  const doctor = profileQuery.data ?? null;

  const [examDate, setExamDate] = useState(todayLocalIsoDate());
  const [purpose, setPurpose] = useState("");
  const [generalCondition, setGeneralCondition] = useState<"good" | "fair">(
    "good",
  );
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [systemicExam, setSystemicExam] = useState("Normal");
  const [honorific, setHonorific] = useState<"" | "Mr." | "Ms.">(
    defaultFitnessHonorific(patientGender),
  );
  const [error, setError] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: (action: "download" | "print") => {
      // Vitals are optional but BP must appear as a pair or not at all.
      const bs = bpSystolic.trim();
      const bd = bpDiastolic.trim();
      if ((bs === "" && bd !== "") || (bs !== "" && bd === "")) {
        return Promise.reject(
          new Error("Enter both systolic AND diastolic, or leave both blank."),
        );
      }
      return trpcClient.export.medicalCertificateFitness
        .mutate({
          patientId,
          examDate,
          purpose: purpose.trim(),
          generalCondition,
          bpSystolic: bs === "" ? null : Number(bs),
          bpDiastolic: bd === "" ? null : Number(bd),
          pulse: pulse.trim() === "" ? null : Number(pulse.trim()),
          systemicExam: systemicExam.trim() || "Normal",
          honorific,
        })
        .then((result) => ({ ...result, action }));
    },
    onSuccess: (data) => {
      if (data.action === "download") {
        downloadBase64File(data.base64, data.filename, "application/pdf");
      } else {
        printBase64Pdf(data.base64);
      }
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const canGenerate =
    purpose.trim().length > 0 &&
    !generateMutation.isPending &&
    !profileQuery.isLoading;

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!doctor) {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-destructive">
          Your doctor profile isn&apos;t set up yet. Fill in Settings → Doctor
          Profile before printing certificates.
        </p>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Patient name, age and address are pre-filled from the patient card. Fill
        in the examination findings and purpose below.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="fit-date">Examination Date</Label>
          <Input
            id="fit-date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Honorific</Label>
          <div className="flex flex-wrap gap-1.5">
            {(["", "Mr.", "Ms."] as const).map((h) => (
              <button
                key={h || "blank"}
                type="button"
                onClick={() => setHonorific(h)}
                className={`rounded border px-2.5 py-1 text-xs ${
                  honorific === h
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {h || "Mr./Ms."}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>General Condition</Label>
        <div className="flex gap-2">
          {(["good", "fair"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setGeneralCondition(c)}
              className={`flex-1 rounded border px-3 py-2 text-sm ${
                generalCondition === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {c === "good" ? "Good" : "Fair"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label htmlFor="fit-bp-s">BP Systolic</Label>
          <Input
            id="fit-bp-s"
            type="number"
            inputMode="numeric"
            min="40"
            max="300"
            value={bpSystolic}
            onChange={(e) => setBpSystolic(e.target.value)}
            placeholder="120"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fit-bp-d">BP Diastolic</Label>
          <Input
            id="fit-bp-d"
            type="number"
            inputMode="numeric"
            min="20"
            max="200"
            value={bpDiastolic}
            onChange={(e) => setBpDiastolic(e.target.value)}
            placeholder="80"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fit-pulse">Pulse (/min)</Label>
          <Input
            id="fit-pulse"
            type="number"
            inputMode="numeric"
            min="20"
            max="300"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            placeholder="72"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fit-systemic">Systemic Examination</Label>
        <Input
          id="fit-systemic"
          value={systemicExam}
          onChange={(e) => setSystemicExam(e.target.value)}
          placeholder="Normal"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fit-purpose">
          Fitness Purpose <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fit-purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. join his duties"
        />
        <div className="flex flex-wrap gap-1">
          {FITNESS_PURPOSES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurpose(p)}
              className="rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Prints as: &quot;The above-named person is medically fit to&nbsp;
          <em>{purpose || "—"}</em>.&quot;
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          onClick={() => generateMutation.mutate("print")}
          disabled={!canGenerate}
        >
          {generateMutation.isPending &&
          generateMutation.variables === "print" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" /> Print
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => generateMutation.mutate("download")}
          disabled={!canGenerate}
        >
          {generateMutation.isPending &&
          generateMutation.variables === "download" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
