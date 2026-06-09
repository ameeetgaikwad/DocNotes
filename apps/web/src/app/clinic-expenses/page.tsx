"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Check,
  Undo2,
  BarChart3,
  X,
} from "lucide-react";
import { DEFAULT_CLINIC_EXPENSE_CATEGORIES } from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate, formatINR, todayLocalIsoDate } from "@/lib/format";
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

type Expense = {
  id: string;
  providerId: string;
  amount: string;
  categoryName: string;
  expenseDate: string;
  paidAt: Date | string | null;
  note: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type Category = {
  name: string;
  isDefault: boolean;
  id: string | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ADD_NEW_OPTION = "__add_new__";

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function ClinicExpensesPage() {
  const queryClient = useQueryClient();
  const init = currentYearMonth();
  const [year, setYear] = useState<number>(init.year);
  const [month, setMonth] = useState<number | "all">(init.month);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [paidFilter, setPaidFilter] = useState<"all" | "paid" | "unpaid">(
    "all",
  );

  const filterInput = useMemo(
    () => ({
      year,
      month: month === "all" ? undefined : month,
      categoryName: categoryFilter || undefined,
      paid:
        paidFilter === "paid"
          ? true
          : paidFilter === "unpaid"
            ? false
            : undefined,
    }),
    [year, month, categoryFilter, paidFilter],
  );

  const listQuery = useQuery(trpc.clinicExpense.list.queryOptions(filterInput));
  const categoriesQuery = useQuery(
    trpc.clinicExpense.listCategories.queryOptions(),
  );

  const items = useMemo(
    () => (listQuery.data ?? []) as Expense[],
    [listQuery.data],
  );
  const categories = (categoriesQuery.data ?? []) as Category[];

  const monthTotal = useMemo(
    () => items.reduce((acc, e) => acc + Number(e.amount), 0),
    [items],
  );
  const paidTotal = useMemo(
    () =>
      items
        .filter((e) => e.paidAt)
        .reduce((acc, e) => acc + Number(e.amount), 0),
    [items],
  );
  const unpaidTotal = monthTotal - paidTotal;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: [["clinicExpense"]] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.clinicExpense.delete.mutate({ id }),
    onSuccess: invalidate,
  });

  const togglePaidMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.clinicExpense.togglePaid.mutate({ id }),
    onSuccess: invalidate,
  });

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setDialogOpen(true);
  }

  function handleDelete(expense: Expense) {
    if (
      window.confirm(
        `Delete ${formatINR(expense.amount)} on ${formatDate(expense.expenseDate)}?`,
      )
    ) {
      deleteMutation.mutate(expense.id);
    }
  }

  const yearOptions = useMemo(() => {
    const curr = new Date().getFullYear();
    return [curr + 1, curr, curr - 1, curr - 2, curr - 3];
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mb-8">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">
            Clinic Expenses
          </h1>
          <p className="text-muted-foreground md:text-base">
            Track your clinic&apos;s operating costs — electricity, rent,
            salaries, medicine purchase, and more.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button
            asChild
            type="button"
            variant="outline"
            className="md:h-12 md:px-5 md:text-base"
          >
            <Link href="/clinic-expenses/summary">
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
              Summary
            </Link>
          </Button>
          <Button onClick={openAdd} className="md:h-12 md:px-6 md:text-base">
            <Plus className="h-4 w-4 md:h-5 md:w-5" />
            Add Expense
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="year" className="text-xs">
            Year
          </Label>
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="month" className="text-xs">
            Month
          </Label>
          <select
            id="month"
            value={month}
            onChange={(e) =>
              setMonth(
                e.target.value === "all" ? "all" : Number(e.target.value),
              )
            }
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="category" className="text-xs">
            Category
          </Label>
          <select
            id="category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="paid" className="text-xs">
            Status
          </Label>
          <select
            id="paid"
            value={paidFilter}
            onChange={(e) =>
              setPaidFilter(e.target.value as "all" | "paid" | "unpaid")
            }
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl">
            {formatINR(monthTotal)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Paid</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300 sm:text-2xl">
            {formatINR(paidTotal)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <p className="text-xs text-amber-700 dark:text-amber-300">Unpaid</p>
          <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-300 sm:text-2xl">
            {formatINR(unpaidTotal)}
          </p>
        </div>
      </div>

      {listQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!listQuery.isLoading && items.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center px-4 py-16 text-muted-foreground">
            <Wallet className="mb-3 h-12 w-12" />
            <p className="text-base font-medium">No expenses yet</p>
            <p className="mt-1 max-w-md text-center text-sm">
              Start tracking your clinic&apos;s operating costs — categorise
              them and see a monthly/yearly breakdown anytime.
            </p>
            <Button type="button" onClick={openAdd} className="mt-5">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {items.map((expense) => {
              const isPaid = Boolean(expense.paidAt);
              return (
                <li
                  key={expense.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-base font-semibold md:text-lg">
                        {formatINR(expense.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {expense.categoryName}
                      </p>
                      <span
                        className={
                          isPaid
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }
                      >
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(expense.expenseDate)}
                    </p>
                    {expense.note && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {expense.note}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => togglePaidMutation.mutate(expense.id)}
                      disabled={togglePaidMutation.isPending}
                    >
                      {isPaid ? (
                        <>
                          <Undo2 className="h-4 w-4" />
                          Mark Unpaid
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Mark Paid
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(expense)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(expense)}
                      disabled={deleteMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        categories={categories}
        onSaved={() => {
          setDialogOpen(false);
          invalidate();
        }}
      />
    </div>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  editing,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Expense | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [categoryName, setCategoryName] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(todayLocalIsoDate());
  const [paid, setPaid] = useState<boolean>(false);
  const [note, setNote] = useState<string>("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setAmount("");
    setCategoryName("");
    setExpenseDate(todayLocalIsoDate());
    setPaid(false);
    setNote("");
    setShowAddCategory(false);
    setNewCategoryName("");
    setFormError(null);
  }

  // Hydrate form when opening for edit, reset when opening for add.
  // Using key prop on the Dialog would also work but we want a stable
  // reference for transitions.
  const lastEditingId = editing?.id ?? null;
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (open && hydratedFor !== (lastEditingId ?? "__add__")) {
    if (editing) {
      setAmount(String(Number(editing.amount)));
      setCategoryName(editing.categoryName);
      setExpenseDate(editing.expenseDate);
      setPaid(Boolean(editing.paidAt));
      setNote(editing.note ?? "");
      setShowAddCategory(false);
      setNewCategoryName("");
      setFormError(null);
    } else {
      resetForm();
    }
    setHydratedFor(lastEditingId ?? "__add__");
  }
  if (!open && hydratedFor !== null) {
    setHydratedFor(null);
  }

  const createMutation = useMutation({
    mutationFn: (input: {
      amount: number;
      categoryName: string;
      expenseDate: string;
      paid: boolean;
      note: string | null;
    }) => trpcClient.clinicExpense.create.mutate(input),
    onSuccess: onSaved,
    onError: (e) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string;
      amount: number;
      categoryName: string;
      expenseDate: string;
      note: string | null;
    }) => trpcClient.clinicExpense.update.mutate(input),
    onSuccess: onSaved,
    onError: (e) => setFormError(e.message),
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) =>
      trpcClient.clinicExpense.addCustomCategory.mutate({ name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: [["clinicExpense", "listCategories"]],
      });
      if (created) setCategoryName(created.name);
      setShowAddCategory(false);
      setNewCategoryName("");
    },
    onError: (e) => setFormError(e.message),
  });

  function handleCategoryChange(value: string) {
    if (value === ADD_NEW_OPTION) {
      setShowAddCategory(true);
      return;
    }
    setCategoryName(value);
  }

  function handleAddNewCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setFormError("Category name is required");
      return;
    }
    addCategoryMutation.mutate(name);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setFormError("Amount must be a positive number");
      return;
    }
    if (!categoryName) {
      setFormError("Category is required");
      return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        amount: n,
        categoryName,
        expenseDate,
        note: note.trim() || null,
      });
    } else {
      createMutation.mutate({
        amount: n,
        categoryName,
        expenseDate,
        paid,
        note: note.trim() || null,
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the amount, category, date, or note for this expense."
              : "Record a clinic operating expense — electricity, rent, salary, and more."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categorySelect">Category</Label>
            {!showAddCategory ? (
              <select
                id="categorySelect"
                value={categoryName}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                    {c.isDefault ? "" : " (custom)"}
                  </option>
                ))}
                {DEFAULT_CLINIC_EXPENSE_CATEGORIES.length > 0 && (
                  <option value={ADD_NEW_OPTION}>+ Add new category…</option>
                )}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="newCategory"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNewCategory}
                  disabled={addCategoryMutation.isPending}
                >
                  {addCategoryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expenseDate">Date</Label>
            <Input
              id="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          {!editing && (
            <div className="flex items-center gap-2">
              <input
                id="paid"
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="paid" className="cursor-pointer text-sm">
                Already paid
              </Label>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any extra context…"
              rows={2}
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
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Add expense"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
