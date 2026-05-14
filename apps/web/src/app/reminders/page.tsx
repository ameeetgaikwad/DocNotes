"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  MessageCircle,
  AlertCircle,
  Wallet,
  Phone,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatPatientName, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const LAG_KEY = "docnotes.reminders.lagDays";
const LAG_DEFAULT = 7;

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
    "नमस्कार {patient_name},\n\nआमच्या क्लिनिकमधील भेटींपोटी ₹{amount} इतकी रक्कम अद्याप थकित आहे. पहिल्या न भरलेल्या भेटीपासून {days_overdue} दिवस झाले आहेत.\n\nकृपया लवकरात लवकर ती रक्कम भरण्याची व्यवस्था करावी. काही प्रश्न असल्यास संपर्क साधावा.\n\nधन्यवाद.",
  hindi:
    "नमस्कार {patient_name},\n\nहमारे क्लिनिक में आपकी विज़िट के संबंध में ₹{amount} की राशि अभी भी बकाया है। पहली बकाया विज़िट को {days_overdue} दिन हो चुके हैं।\n\nकृपया जल्द ही यह राशि चुकाने का प्रबंध करें। किसी भी प्रश्न के लिए संपर्क करें।\n\nधन्यवाद।",
};

const TEMPLATE_KEY_PREFIX = "docnotes.reminders.template.";

function readLag(): number {
  if (typeof window === "undefined") return LAG_DEFAULT;
  const v = window.localStorage.getItem(LAG_KEY);
  if (!v) return LAG_DEFAULT;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 365 ? n : LAG_DEFAULT;
}

function readTemplate(lang: TemplateLang): string {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES[lang];
  const v = window.localStorage.getItem(TEMPLATE_KEY_PREFIX + lang);
  return v ?? DEFAULT_TEMPLATES[lang];
}

function normalizePhoneForWa(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

function fillTemplate(
  template: string,
  values: { patient_name: string; amount: string; days_overdue: number },
): string {
  return template
    .replace(/\{patient_name\}/g, values.patient_name)
    .replace(/\{amount\}/g, values.amount)
    .replace(/\{days_overdue\}/g, String(values.days_overdue));
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

interface OverdueRow {
  patientId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
  oldestDueDate: string;
  outstanding: number;
  daysOverdue: number;
}

export default function RemindersPage() {
  const [lag, setLag] = useState<number>(LAG_DEFAULT);
  const [lagInput, setLagInput] = useState<string>(String(LAG_DEFAULT));
  const [lang, setLang] = useState<TemplateLang>("english");

  useEffect(() => {
    const v = readLag();
    setLag(v);
    setLagInput(String(v));
  }, []);

  function commitLag(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 365) {
      setLagInput(String(lag));
      return;
    }
    setLag(n);
    setLagInput(String(n));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAG_KEY, String(n));
    }
  }

  const overdueQuery = useQuery(
    trpc.dailyRegister.overdueDues.queryOptions({ days: lag }),
  );

  const items = (overdueQuery.data ?? []) as OverdueRow[];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold md:text-3xl">
          Pending Dues Reminders
        </h1>
        <p className="text-muted-foreground md:text-base">
          Patients with outstanding dues older than the wait period — tap to
          send a WhatsApp reminder.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:gap-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="lag-days"
            className="text-xs font-medium text-muted-foreground"
          >
            Wait period (days)
          </label>
          <input
            id="lag-days"
            type="number"
            min="0"
            max="365"
            inputMode="numeric"
            value={lagInput}
            onChange={(e) => setLagInput(e.target.value)}
            onBlur={(e) => commitLag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitLag((e.target as HTMLInputElement).value);
              }
            }}
            className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="lang-select"
            className="text-xs font-medium text-muted-foreground"
          >
            Reminder language
          </label>
          <Select
            id="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value as TemplateLang)}
            className="w-44"
          >
            {TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_LABELS[k]}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          Customize templates and the default language in{" "}
          <a href="/settings" className="text-primary hover:underline">
            Settings → Reminder Templates
          </a>
          .
        </p>
      </div>

      {overdueQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {overdueQuery.error && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="mb-3 h-10 w-10 text-destructive/60" />
            <p className="text-base font-medium">Failed to load reminders</p>
          </div>
        </div>
      )}

      {!overdueQuery.isLoading && !overdueQuery.error && items.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Wallet className="mb-3 h-12 w-12" />
            <p className="text-base font-medium">
              No reminders to send right now
            </p>
            <p className="text-sm">
              No patient has outstanding dues older than {lag} day
              {lag === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {items.map((row) => (
              <ReminderRow key={row.patientId} row={row} lang={lang} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReminderRow({ row, lang }: { row: OverdueRow; lang: TemplateLang }) {
  const messageText = useMemo(() => {
    const template = readTemplate(lang);
    return fillTemplate(template, {
      patient_name: formatPatientName(row),
      amount: row.outstanding.toFixed(2),
      days_overdue: row.daysOverdue,
    });
  }, [lang, row]);

  const phoneDigits = normalizePhoneForWa(row.phone);
  const canSend = phoneDigits.length >= 7;

  function send() {
    if (!canSend) return;
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium md:text-base">
          {formatPatientName(row)}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{formatINR(row.outstanding)}</span>
          <span>
            {row.daysOverdue} day{row.daysOverdue === 1 ? "" : "s"} since{" "}
            {formatDate(row.oldestDueDate)}
          </span>
          {row.phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {row.phone}
            </span>
          ) : (
            <span className="text-destructive">No phone on file</span>
          )}
        </div>
      </div>
      <Button
        type="button"
        onClick={send}
        disabled={!canSend}
        title={
          canSend
            ? "Open WhatsApp"
            : "Add a phone number on the patient card first"
        }
      >
        <MessageCircle className="h-4 w-4" />
        Send
      </Button>
    </li>
  );
}
