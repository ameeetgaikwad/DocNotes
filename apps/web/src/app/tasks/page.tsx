"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ClipboardList,
  Plus,
  Phone,
  Pencil,
  Trash2,
  Check,
  Home,
  AlertCircle,
  FileEdit,
  CheckCircle2,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import {
  formatDate,
  formatINR,
  formatPatientName,
  todayLocalIsoDate,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogClose as DialogClose,
} from "@/components/ui/responsive-dialog";

type HomeVisitRow = {
  id: string;
  providerId: string;
  patientName: string;
  scheduledAt: Date | string;
  completedAt: Date | string | null;
  note: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type CustomTodoRow = {
  id: string;
  providerId: string;
  text: string;
  dueDate: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type OverdueRow = {
  patientId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
  oldestDueDate: string;
  outstanding: number;
  daysOverdue: number;
};

type IncompleteRow = {
  id: string;
  visitDate: string;
  patientId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
};

function formatScheduledTime(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ActionsPage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery(trpc.doctorProfile.me.queryOptions());
  const threshold = (profileQuery.data?.overdueDaysThreshold as number) ?? 7;

  const overdueQuery = useQuery(
    trpc.dailyRegister.overdueDues.queryOptions({ days: threshold }),
  );
  const homeVisitsQuery = useQuery(trpc.homeVisit.listToday.queryOptions());
  const incompleteQuery = useQuery(
    trpc.dailyRegister.incompleteVisits.queryOptions(),
  );
  const todosQuery = useQuery(trpc.customTodo.list.queryOptions());

  const overdue = (overdueQuery.data ?? []) as OverdueRow[];
  const homeVisits = (homeVisitsQuery.data ?? []) as HomeVisitRow[];
  const incomplete = (incompleteQuery.data ?? []) as IncompleteRow[];
  const todos = (todosQuery.data ?? []) as CustomTodoRow[];
  const pendingTodoCount = todos.filter((t) => !t.completedAt).length;

  const isLoading =
    overdueQuery.isLoading ||
    homeVisitsQuery.isLoading ||
    incompleteQuery.isLoading ||
    todosQuery.isLoading;
  const allClear =
    overdue.length === 0 &&
    homeVisits.length === 0 &&
    incomplete.length === 0 &&
    todos.length === 0;

  const [homeDialogOpen, setHomeDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<HomeVisitRow | null>(null);
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<CustomTodoRow | null>(null);

  function invalidateActions() {
    queryClient.invalidateQueries({ queryKey: [["homeVisit"]] });
    queryClient.invalidateQueries({ queryKey: [["customTodo"]] });
    queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] });
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2 md:mb-8">
        <h1 className="text-2xl font-semibold md:text-3xl">Actions</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Things that need your attention today.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && allClear && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center px-4 py-16 text-muted-foreground">
            <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-600" />
            <p className="text-base font-medium">All clear for today</p>
            <p className="mt-1 max-w-md text-center text-sm">
              No overdue calls, no home visits scheduled, no incomplete visits,
              and no to-dos pending. Add a home visit or to-do whenever
              something comes up.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingVisit(null);
                  setHomeDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Home Visit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingTodo(null);
                  setTodoDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add To-Do
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !allClear && (
        <div className="space-y-6">
          <OverdueSection rows={overdue} thresholdDays={threshold} />
          <HomeVisitsSection
            rows={homeVisits}
            onAdd={() => {
              setEditingVisit(null);
              setHomeDialogOpen(true);
            }}
            onEdit={(v) => {
              setEditingVisit(v);
              setHomeDialogOpen(true);
            }}
            onChanged={invalidateActions}
          />
          <IncompleteSection rows={incomplete} />
          <CustomTodosSection
            rows={todos}
            pendingCount={pendingTodoCount}
            onAdd={() => {
              setEditingTodo(null);
              setTodoDialogOpen(true);
            }}
            onEdit={(t) => {
              setEditingTodo(t);
              setTodoDialogOpen(true);
            }}
            onChanged={invalidateActions}
          />
        </div>
      )}

      <HomeVisitDialog
        open={homeDialogOpen}
        onOpenChange={setHomeDialogOpen}
        editing={editingVisit}
        onSaved={() => {
          setHomeDialogOpen(false);
          invalidateActions();
        }}
      />
      <CustomTodoDialog
        open={todoDialogOpen}
        onOpenChange={setTodoDialogOpen}
        editing={editingTodo}
        onSaved={() => {
          setTodoDialogOpen(false);
          invalidateActions();
        }}
      />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold md:text-lg">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function OverdueSection({
  rows,
  thresholdDays,
}: {
  rows: OverdueRow[];
  thresholdDays: number;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionHeader
        icon={AlertCircle}
        title="Overdue Patient Calls"
        count={rows.length}
      />
      <p className="mb-2 text-xs text-muted-foreground">
        Pending dues older than {thresholdDays} day
        {thresholdDays === 1 ? "" : "s"}. Change the threshold in Settings.
      </p>
      <div className="rounded-xl border bg-card">
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.patientId}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium md:text-base">
                  {formatPatientName(r)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatINR(r.outstanding)} pending · {r.daysOverdue} day
                  {r.daysOverdue === 1 ? "" : "s"} overdue
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                {r.phone && (
                  <Button asChild type="button" size="sm">
                    <a href={`tel:${r.phone}`}>
                      <Phone className="h-4 w-4" />
                      Call Now
                    </a>
                  </Button>
                )}
                <Button asChild type="button" variant="outline" size="sm">
                  <Link href={`/patients/${r.patientId}`}>View</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HomeVisitsSection({
  rows,
  onAdd,
  onEdit,
  onChanged,
}: {
  rows: HomeVisitRow[];
  onAdd: () => void;
  onEdit: (v: HomeVisitRow) => void;
  onChanged: () => void;
}) {
  const markMutation = useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      trpcClient.homeVisit.markCompleted.mutate(input),
    onSuccess: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.homeVisit.delete.mutate({ id }),
    onSuccess: onChanged,
  });

  return (
    <section>
      <SectionHeader
        icon={Home}
        title="Today's Home Visits"
        count={rows.length}
        action={
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          No home visits scheduled for today.{" "}
          <button
            type="button"
            onClick={onAdd}
            className="text-primary underline-offset-4 hover:underline"
          >
            Add one
          </button>
          .
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {rows.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium md:text-base">
                    {v.patientName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatScheduledTime(v.scheduledAt)}
                    {v.note ? ` · ${v.note}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      markMutation.mutate({ id: v.id, completed: true })
                    }
                    disabled={markMutation.isPending}
                  >
                    <Check className="h-4 w-4" />
                    Mark Done
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(v)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(`Delete visit for ${v.patientName}?`)
                      ) {
                        deleteMutation.mutate(v.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function IncompleteSection({ rows }: { rows: IncompleteRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionHeader
        icon={FileEdit}
        title="Incomplete Visits"
        count={rows.length}
      />
      <p className="mb-2 text-xs text-muted-foreground">
        Visits with no clinical notes AND no vitals recorded.
      </p>
      <div className="rounded-xl border bg-card">
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium md:text-base">
                  {formatPatientName(r)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(r.visitDate)} · No clinical data recorded
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <Button asChild type="button" size="sm" variant="outline">
                  <Link href={`/patients/${r.patientId}`}>
                    <Pencil className="h-4 w-4" />
                    View entry
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CustomTodosSection({
  rows,
  pendingCount,
  onAdd,
  onEdit,
  onChanged,
}: {
  rows: CustomTodoRow[];
  pendingCount: number;
  onAdd: () => void;
  onEdit: (t: CustomTodoRow) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const listKey = trpc.customTodo.list.queryOptions().queryKey;

  // Optimistic toggle so the row repositions instantly (the row's
  // updatedAt is bumped client-side first, then the server confirms).
  // Mirrors the Purchase List pattern Manoj asked for in msg 1549.
  const markMutation = useMutation({
    mutationFn: (input: { id: string; done: boolean }) =>
      trpcClient.customTodo.markDone.mutate(input),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData(listKey);
      queryClient.setQueryData<CustomTodoRow[]>(listKey, (old) =>
        (old ?? []).map((t) =>
          t.id === id
            ? {
                ...t,
                completedAt: done ? new Date() : null,
                updatedAt: new Date(),
              }
            : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(listKey, ctx.prev);
    },
    onSettled: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.customTodo.delete.mutate({ id }),
    onSuccess: onChanged,
  });

  // Manoj msg 1549 (mirrors Purchase List msg 1326): ticked rows
  // grouped at the TOP, ordered by updatedAt asc — a newly-ticked
  // item lands at the bottom of the ticked group. Unticked rows
  // below, ordered by updatedAt desc — a newly-unticked item lands
  // at the top of the unticked group. Both pivots on updatedAt
  // which we bump optimistically above.
  const sortedRows = useMemo(() => {
    const done = rows
      .filter((t) => t.completedAt)
      .sort(
        (a, b) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      );
    const open = rows
      .filter((t) => !t.completedAt)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    return [...done, ...open];
  }, [rows]);

  return (
    <section>
      <SectionHeader
        icon={ClipboardList}
        title="To-Dos"
        count={pendingCount}
        action={
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          No to-dos yet.{" "}
          <button
            type="button"
            onClick={onAdd}
            className="text-primary underline-offset-4 hover:underline"
          >
            Add one
          </button>
          .
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {sortedRows.map((t) => {
              const isDone = Boolean(t.completedAt);
              return (
                <li
                  key={t.id}
                  className="flex items-start gap-3 px-4 py-3 sm:px-6 sm:py-4"
                >
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() =>
                      markMutation.mutate({ id: t.id, done: !isDone })
                    }
                    className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                    aria-label={`${isDone ? "Unmark" : "Mark done"}: ${t.text}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm md:text-base">{t.text}</p>
                    {t.dueDate && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Due {formatDate(t.dueDate)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit to-do"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this to-do?")) {
                        deleteMutation.mutate(t.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Delete to-do"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// Form helpers — keep these compact since the page is already large.

function defaultScheduledLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toLocalDateTimeString(d: Date | string): string {
  const date = new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function HomeVisitDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: HomeVisitRow | null;
  onSaved: () => void;
}) {
  const [patientName, setPatientName] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>(
    defaultScheduledLocal(),
  );
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (open && hydratedFor !== (editing?.id ?? "__add__")) {
    if (editing) {
      setPatientName(editing.patientName);
      setScheduledAt(toLocalDateTimeString(editing.scheduledAt));
      setNote(editing.note ?? "");
    } else {
      setPatientName("");
      setScheduledAt(defaultScheduledLocal());
      setNote("");
    }
    setFormError(null);
    setHydratedFor(editing?.id ?? "__add__");
  }
  if (!open && hydratedFor !== null) setHydratedFor(null);

  const createMutation = useMutation({
    mutationFn: (input: {
      patientName: string;
      scheduledAt: Date;
      note: string | null;
    }) => trpcClient.homeVisit.create.mutate(input),
    onSuccess: onSaved,
    onError: (e) => setFormError(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string;
      patientName: string;
      scheduledAt: Date;
      note: string | null;
    }) => trpcClient.homeVisit.update.mutate(input),
    onSuccess: onSaved,
    onError: (e) => setFormError(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const name = patientName.trim();
    if (!name) {
      setFormError("Patient name is required");
      return;
    }
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      setFormError("Pick a valid time");
      return;
    }
    const payload = {
      patientName: name,
      scheduledAt: when,
      note: note.trim() || null,
    };
    if (editing) updateMutation.mutate({ id: editing.id, ...payload });
    else createMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit home visit" : "Add home visit"}
          </DialogTitle>
          <DialogDescription>
            Schedule a domiciliary visit for today. The patient doesn&apos;t
            need to be in your register yet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="patientName">Patient name</Label>
            <Input
              id="patientName"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              autoFocus
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledAt">Time</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
          {formError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              {formError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Add visit"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomTodoDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CustomTodoRow | null;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (open && hydratedFor !== (editing?.id ?? "__add__")) {
    if (editing) {
      setText(editing.text);
      setDueDate(editing.dueDate ?? "");
    } else {
      setText("");
      setDueDate("");
    }
    setFormError(null);
    setHydratedFor(editing?.id ?? "__add__");
  }
  if (!open && hydratedFor !== null) setHydratedFor(null);

  const createMutation = useMutation({
    mutationFn: (input: { text: string; dueDate: string | null }) =>
      trpcClient.customTodo.create.mutate(input),
    onSuccess: onSaved,
    onError: (e) => setFormError(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: (input: { id: string; text: string; dueDate: string | null }) =>
      trpcClient.customTodo.update.mutate(input),
    onSuccess: onSaved,
    onError: (e) => setFormError(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setFormError("Task description is required");
      return;
    }
    const payload = { text: trimmed, dueDate: dueDate || null };
    if (editing) updateMutation.mutate({ id: editing.id, ...payload });
    else createMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit to-do" : "Add to-do"}</DialogTitle>
          <DialogDescription>
            Anything else you want to keep track of — calls to make, supplies to
            order, follow-ups outside the register.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="todoText">Task</Label>
            <Textarea
              id="todoText"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due date</Label>
            {/* Only block past-dates on new to-dos. Editing an
                overdue to-do (whose due_date is already in the past)
                must not be locked out — the doctor may just want to
                fix a typo in the text. Amit review 2026-06-12 P3. */}
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={editing ? undefined : todayLocalIsoDate()}
            />
          </div>
          {formError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              {formError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Add to-do"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
