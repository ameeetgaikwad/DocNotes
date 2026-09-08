export function todayLocalIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Indian Financial Year helpers: FY starts April 1 and ends March 31 of
// the next year. Used by Daily Case Register export + the Register
// Summary panel on the Dashboard.
export function currentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export function fyLabel(y: number): string {
  return `FY ${y}-${String(y + 1).slice(2)}`;
}

export function fyRange(y: number): { startDate: string; endDate: string } {
  return { startDate: `${y}-04-01`, endDate: `${y + 1}-03-31` };
}

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "₹0";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "₹0";
  return `₹${INR_FORMATTER.format(n)}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function calculateAge(
  dob: Date | string | null | undefined,
): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

export function formatGender(gender: string | null | undefined): string {
  if (!gender) return "—";
  return gender === "prefer_not_to_say"
    ? "Not specified"
    : gender.charAt(0).toUpperCase() + gender.slice(1);
}

export function formatPatientName(p: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

// Total months between a birth date and today. Manoj msg 2810 — infants
// should display in months, not "0 years".
function monthsBetween(birth: Date, now: Date = new Date()): number {
  const years = now.getFullYear() - birth.getFullYear();
  let months = years * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(months, 0);
}

// "8 months" / "3 years" — auto-picks months when age is under 1 year AND
// we have enough date precision to compute months. Falls back to years.
export function formatAgeText(
  age: number | null,
  ageMonths: number | null,
): string | null {
  if (ageMonths != null && ageMonths < 12) {
    return ageMonths === 1 ? "1 month" : `${ageMonths} months`;
  }
  if (age != null) {
    return age === 1 ? "1 year" : `${age} years`;
  }
  return null;
}

/**
 * Returns renderable age (years + optional months) and date-of-birth for
 * a patient. Falls back to partial-DOB fields when full `dateOfBirth` is
 * absent — year-only / month+year / day+month+year are all rendered as
 * best the data allows.
 *
 * `ageMonths` is populated whenever we can compute months (i.e. we have
 * at least month+year precision, OR only year but the birth year is
 * within the last 2 years — where a Jan-1 assumption yields useful
 * infant/toddler months for Manoj msg 2810).
 */
export function formatPatientAgeDob(p: {
  dateOfBirth: Date | string | null | undefined;
  dobDay?: number | null;
  dobMonth?: number | null;
  dobYear?: number | null;
}): {
  age: number | null;
  ageMonths: number | null;
  display: string | null;
} {
  if (p.dateOfBirth) {
    const birth = new Date(p.dateOfBirth);
    return {
      age: calculateAge(p.dateOfBirth),
      ageMonths: monthsBetween(birth),
      display: formatDate(p.dateOfBirth),
    };
  }

  const d = p.dobDay ?? null;
  const m = p.dobMonth ?? null;
  const y = p.dobYear ?? null;

  if (d && m && y) {
    const birth = new Date(y, m - 1, d);
    return {
      age: calculateAge(birth),
      ageMonths: monthsBetween(birth),
      display: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
    };
  }

  if (m && y) {
    // Assume day = 1 for month-precision births — same fudge the previous
    // code did (via `now.getMonth() + 1 < m` for the year decrement).
    const birth = new Date(y, m - 1, 1);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m) age -= 1;
    return {
      age: age >= 0 ? age : null,
      ageMonths: monthsBetween(birth, now),
      display: `${String(m).padStart(2, "0")}/${y}`,
    };
  }

  if (y) {
    const now = new Date();
    const age = now.getFullYear() - y;
    // Compute months from Jan 1 of the birth year — useful only for
    // year-of-birth === current year (infant, no month recorded) or
    // last year (young toddler). Beyond that, "N years" is fine.
    const ageMonths = age <= 1 ? monthsBetween(new Date(y, 0, 1), now) : null;
    return {
      age: age >= 0 ? age : null,
      ageMonths,
      display: String(y),
    };
  }

  return { age: null, ageMonths: null, display: null };
}
