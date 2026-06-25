"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Split-payment sub-block (Manoj msg 1926). Cash + Digital are editable;
// Balance is derived as max(0, fee - cash - digital) so the doctor only
// needs to enter two of the three. Renders an inline sum-vs-fee check
// in red when cash + digital exceeds fee.
export function SplitPaymentBlock({
  feeAmount,
  cash,
  digital,
  setCash,
  setDigital,
  idPrefix = "split",
}: {
  feeAmount: string;
  cash: string;
  digital: string;
  setCash: (v: string) => void;
  setDigital: (v: string) => void;
  idPrefix?: string;
}) {
  const fee = Number(feeAmount) || 0;
  const c = Number(cash) || 0;
  const d = Number(digital) || 0;
  const balance = Math.max(0, fee - c - d);
  const exceeded = c + d > fee + 0.005;
  // Stacked rows on mobile, 3-up on tablet+. Stacking keeps the digit
  // inputs full-width so large system font settings can't crush the
  // numbers (Manoj msg 1962 accessibility ask).
  return (
    <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-3 md:p-4">
      <Label className="text-base font-semibold md:text-lg">
        Split Payment
      </Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3">
        <div className="space-y-1">
          <Label
            htmlFor={`${idPrefix}-cash`}
            className="text-sm font-medium md:text-base"
          >
            Cash (₹)
          </Label>
          <Input
            id={`${idPrefix}-cash`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            className="h-12 text-lg font-medium tabular-nums md:h-12 md:text-xl"
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`${idPrefix}-digital`}
            className="text-sm font-medium md:text-base"
          >
            Digital / UPI (₹)
          </Label>
          <Input
            id={`${idPrefix}-digital`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={digital}
            onChange={(e) => setDigital(e.target.value)}
            className="h-12 text-lg font-medium tabular-nums md:h-12 md:text-xl"
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`${idPrefix}-balance`}
            className="text-sm font-medium md:text-base"
          >
            Balance (₹) — auto
          </Label>
          <Input
            id={`${idPrefix}-balance`}
            type="number"
            value={balance.toFixed(2)}
            readOnly
            tabIndex={-1}
            className="h-12 bg-muted/60 text-lg font-semibold tabular-nums md:h-12 md:text-xl"
          />
        </div>
      </div>
      {exceeded ? (
        <p className="text-sm text-destructive">
          Cash + Digital (₹{(c + d).toFixed(2)}) exceed the Fee Amount (₹
          {fee.toFixed(2)}). Reduce one of them or raise the fee.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground md:text-sm">
          Balance updates automatically and will show up under Pending Dues for
          this patient.
        </p>
      )}
    </div>
  );
}
