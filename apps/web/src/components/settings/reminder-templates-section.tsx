"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const TEMPLATE_KEYS = ["english", "marathi", "hindi"] as const;
type TemplateLang = (typeof TEMPLATE_KEYS)[number];

const TEMPLATE_LABELS: Record<TemplateLang, string> = {
  english: "English",
  marathi: "मराठी (Marathi)",
  hindi: "हिन्दी (Hindi)",
};

const DEFAULT_TEMPLATES: Record<TemplateLang, string> = {
  english:
    "Dear {patient_name},\n\nThis is a reminder that an outstanding amount of ₹{amount} is pending against your visits at our clinic. It has been {days_overdue} days since the earliest unpaid visit.\n\nKindly arrange to settle the amount at your convenience. Please reach out if you have any questions.\n\nThank you.",
  marathi:
    "{patient_name}\nआमच्या क्लिनिकची फी ₹{amount} बाकी आहे.\n{date}\nकृपया लवकरात लवकर भरण्याची व्यवस्था करावी.\nधन्यवाद.",
  hindi:
    "नमस्कार {patient_name},\n\nहमारे क्लिनिक में आपकी विज़िट के संबंध में ₹{amount} की राशि अभी भी बकाया है। पहली बकाया विज़िट को {days_overdue} दिन हो चुके हैं।\n\nकृपया जल्द ही यह राशि चुकाने का प्रबंध करें। किसी भी प्रश्न के लिए संपर्क करें।\n\nधन्यवाद।",
};

const NEXT_VISIT_DEFAULTS: Record<TemplateLang, string> = {
  english:
    "Dear {patient_name},\n\nThis is a reminder for your {type} appointment at our clinic on {date} at {time}.\n\nPlease let us know if you need to reschedule.\n\nThank you.",
  marathi:
    "{patient_name}\nआपली पुढील भेट आमच्या क्लिनिकमध्ये {date} रोजी {time} वाजता नियोजित आहे.\nकाही बदल असल्यास कळवा.\nधन्यवाद.",
  hindi:
    "नमस्कार {patient_name},\n\nआपकी अगली विज़िट हमारे क्लिनिक में {date} को {time} बजे निर्धारित है।\n\nकोई बदलाव हो तो कृपया सूचित करें।\n\nधन्यवाद।",
};

const TEMPLATE_KEY_PREFIX = "docnotes.reminders.template.";
const NEXT_VISIT_TEMPLATE_KEY_PREFIX = "docnotes.reminders.nextVisit.template.";
const LAG_KEY = "docnotes.reminders.lagDays";
const LAG_DEFAULT = 7;

export function ReminderTemplatesSection() {
  const [lag, setLag] = useState<string>(String(LAG_DEFAULT));
  const [templates, setTemplates] =
    useState<Record<TemplateLang, string>>(DEFAULT_TEMPLATES);
  const [nextVisitTemplates, setNextVisitTemplates] =
    useState<Record<TemplateLang, string>>(NEXT_VISIT_DEFAULTS);
  const [savedTick, setSavedTick] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLag = window.localStorage.getItem(LAG_KEY);
    if (storedLag) setLag(storedLag);
    const dues: Record<TemplateLang, string> = { ...DEFAULT_TEMPLATES };
    const next: Record<TemplateLang, string> = { ...NEXT_VISIT_DEFAULTS };
    for (const k of TEMPLATE_KEYS) {
      const v = window.localStorage.getItem(TEMPLATE_KEY_PREFIX + k);
      if (v != null) dues[k] = v;
      const nv = window.localStorage.getItem(
        NEXT_VISIT_TEMPLATE_KEY_PREFIX + k,
      );
      if (nv != null) next[k] = nv;
    }
    setTemplates(dues);
    setNextVisitTemplates(next);
  }, []);

  function save() {
    if (typeof window === "undefined") return;
    const n = Number(lag);
    if (Number.isFinite(n) && n >= 0 && n <= 365) {
      window.localStorage.setItem(LAG_KEY, String(n));
    }
    for (const k of TEMPLATE_KEYS) {
      window.localStorage.setItem(TEMPLATE_KEY_PREFIX + k, templates[k]);
      window.localStorage.setItem(
        NEXT_VISIT_TEMPLATE_KEY_PREFIX + k,
        nextVisitTemplates[k],
      );
    }
    setSavedTick((t) => t + 1);
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reminder Templates</h2>
          <p className="text-sm text-muted-foreground">
            Used by the Reminders page to compose WhatsApp messages. Available
            placeholders:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {"{patient_name}"}
            </code>
            ,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {"{amount}"}
            </code>
            ,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {"{days_overdue}"}
            </code>
            .
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="lag-input" className="text-xs">
            Wait period before reminding (days)
          </Label>
          <input
            id="lag-input"
            type="number"
            min="0"
            max="365"
            inputMode="numeric"
            value={lag}
            onChange={(e) => setLag(e.target.value)}
            className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold">Pending Dues</h3>
      <div className="space-y-4">
        {TEMPLATE_KEYS.map((k) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`tpl-${k}`} className="text-xs">
              {TEMPLATE_LABELS[k]}
            </Label>
            <Textarea
              id={`tpl-${k}`}
              rows={5}
              value={templates[k]}
              onChange={(e) =>
                setTemplates((prev) => ({ ...prev, [k]: e.target.value }))
              }
              className="font-mono text-xs sm:text-sm"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 border-t pt-4">
        <h3 className="mb-1 text-sm font-semibold">Next Visit</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Placeholders:{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {"{patient_name}"}
          </code>{" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{date}"}</code>{" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{time}"}</code>{" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{type}"}</code>
        </p>
        <div className="space-y-4">
          {TEMPLATE_KEYS.map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`nv-tpl-${k}`} className="text-xs">
                {TEMPLATE_LABELS[k]}
              </Label>
              <Textarea
                id={`nv-tpl-${k}`}
                rows={5}
                value={nextVisitTemplates[k]}
                onChange={(e) =>
                  setNextVisitTemplates((prev) => ({
                    ...prev,
                    [k]: e.target.value,
                  }))
                }
                className="font-mono text-xs sm:text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" size="sm" onClick={save}>
          <Save className="h-4 w-4" />
          Save templates
        </Button>
        {savedTick > 0 && (
          <span key={savedTick} className="text-xs text-muted-foreground">
            Saved locally.
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 align-text-bottom" />
        Templates are stored in this browser for now. Once we move them to your
        cloud profile they&apos;ll sync across devices.
      </p>
    </div>
  );
}
