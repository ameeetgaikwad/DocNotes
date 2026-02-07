import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { soapNoteSchema, vitalsSchema } from "@docnotes/shared";
import { trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const visitNoteFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  bloodPressureSystolic: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .or(z.literal("")),
  bloodPressureDiastolic: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .or(z.literal("")),
  heartRate: z.coerce.number().int().positive().optional().or(z.literal("")),
  temperature: z.coerce.number().positive().optional().or(z.literal("")),
  weight: z.coerce.number().positive().optional().or(z.literal("")),
  height: z.coerce.number().positive().optional().or(z.literal("")),
  oxygenSaturation: z.coerce
    .number()
    .min(0)
    .max(100)
    .optional()
    .or(z.literal("")),
  respiratoryRate: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .or(z.literal("")),
  diagnoses: z.string().optional(),
});

type VisitNoteFormValues = z.infer<typeof visitNoteFormSchema>;

interface VisitNoteEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}

export function VisitNoteEditor({
  open,
  onOpenChange,
  patientId,
}: VisitNoteEditorProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VisitNoteFormValues>({
    resolver: zodResolver(visitNoteFormSchema),
    defaultValues: {
      title: "",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      diagnoses: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: VisitNoteFormValues) => {
      const soap = soapNoteSchema.parse({
        subjective: data.subjective || undefined,
        objective: data.objective || undefined,
        assessment: data.assessment || undefined,
        plan: data.plan || undefined,
      });

      const hasVitals = [
        data.bloodPressureSystolic,
        data.bloodPressureDiastolic,
        data.heartRate,
        data.temperature,
        data.weight,
        data.height,
        data.oxygenSaturation,
        data.respiratoryRate,
      ].some((v) => v !== "" && v !== undefined);

      const vitals = hasVitals
        ? vitalsSchema.parse({
            bloodPressureSystolic:
              data.bloodPressureSystolic === ""
                ? undefined
                : data.bloodPressureSystolic,
            bloodPressureDiastolic:
              data.bloodPressureDiastolic === ""
                ? undefined
                : data.bloodPressureDiastolic,
            heartRate: data.heartRate === "" ? undefined : data.heartRate,
            temperature: data.temperature === "" ? undefined : data.temperature,
            weight: data.weight === "" ? undefined : data.weight,
            height: data.height === "" ? undefined : data.height,
            oxygenSaturation:
              data.oxygenSaturation === "" ? undefined : data.oxygenSaturation,
            respiratoryRate:
              data.respiratoryRate === "" ? undefined : data.respiratoryRate,
          })
        : null;

      const diagnoses = data.diagnoses
        ? data.diagnoses
            .split(",")
            .map((d: string) => d.trim())
            .filter(Boolean)
        : [];

      return trpcClient.medicalRecord.create.mutate({
        patientId,
        type: "visit_note",
        title: data.title,
        content: soap,
        vitals,
        diagnoses,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["medicalRecord"]] });
      reset();
      setServerError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      setServerError(error.message);
    },
  });

  const onSubmit = (data: VisitNoteFormValues) => {
    setServerError(null);
    createMutation.mutate(data);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setServerError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Visit Note</DialogTitle>
          <DialogDescription>
            Record a SOAP note for this visit. All sections are optional except
            the title.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Visit Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Follow-up for hypertension"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              SOAP Note
            </h3>

            <div className="space-y-2">
              <Label htmlFor="subjective">
                Subjective{" "}
                <span className="font-normal text-muted-foreground">
                  — Patient&apos;s symptoms and complaints
                </span>
              </Label>
              <Textarea
                id="subjective"
                placeholder="Chief complaint, history of present illness, review of systems..."
                rows={3}
                {...register("subjective")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">
                Objective{" "}
                <span className="font-normal text-muted-foreground">
                  — Exam findings and test results
                </span>
              </Label>
              <Textarea
                id="objective"
                placeholder="Physical exam findings, lab results, imaging..."
                rows={3}
                {...register("objective")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment">
                Assessment{" "}
                <span className="font-normal text-muted-foreground">
                  — Diagnosis and clinical impression
                </span>
              </Label>
              <Textarea
                id="assessment"
                placeholder="Diagnosis, differential diagnoses, clinical reasoning..."
                rows={3}
                {...register("assessment")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">
                Plan{" "}
                <span className="font-normal text-muted-foreground">
                  — Treatment and follow-up
                </span>
              </Label>
              <Textarea
                id="plan"
                placeholder="Medications, procedures, referrals, follow-up schedule..."
                rows={3}
                {...register("plan")}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Vitals
            </h3>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="bloodPressureSystolic" className="text-xs">
                  BP Systolic
                </Label>
                <Input
                  id="bloodPressureSystolic"
                  type="number"
                  placeholder="mmHg"
                  {...register("bloodPressureSystolic")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bloodPressureDiastolic" className="text-xs">
                  BP Diastolic
                </Label>
                <Input
                  id="bloodPressureDiastolic"
                  type="number"
                  placeholder="mmHg"
                  {...register("bloodPressureDiastolic")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heartRate" className="text-xs">
                  Heart Rate
                </Label>
                <Input
                  id="heartRate"
                  type="number"
                  placeholder="bpm"
                  {...register("heartRate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="respiratoryRate" className="text-xs">
                  Resp. Rate
                </Label>
                <Input
                  id="respiratoryRate"
                  type="number"
                  placeholder="/min"
                  {...register("respiratoryRate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature" className="text-xs">
                  Temperature
                </Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  placeholder="°C"
                  {...register("temperature")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oxygenSaturation" className="text-xs">
                  SpO2
                </Label>
                <Input
                  id="oxygenSaturation"
                  type="number"
                  placeholder="%"
                  {...register("oxygenSaturation")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-xs">
                  Weight
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="kg"
                  {...register("weight")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-xs">
                  Height
                </Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  placeholder="cm"
                  {...register("height")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnoses">
              Diagnoses{" "}
              <span className="font-normal text-muted-foreground">
                — Comma-separated
              </span>
            </Label>
            <Input
              id="diagnoses"
              placeholder="e.g. Hypertension, Type 2 Diabetes"
              {...register("diagnoses")}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Visit Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
