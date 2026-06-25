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
  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3 md:p-4">
      <Label className="md:text-base">Split Payment</Label>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-cash`} className="text-xs md:text-sm">
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
            className="h-10 md:h-11 md:text-base"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-digital`} className="text-xs md:text-sm">
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
            className="h-10 md:h-11 md:text-base"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-balance`} className="text-xs md:text-sm">
            Balance (₹)
          </Label>
          <Input
            id={`${idPrefix}-balance`}
            type="number"
            value={balance.toFixed(2)}
            readOnly
            tabIndex={-1}
            className="h-10 bg-muted/60 font-medium md:h-11 md:text-base"
          />
        </div>
      </div>
      {exceeded ? (
        <p className="text-xs text-destructive md:text-sm">
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
