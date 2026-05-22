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

/**
 * Returns a renderable age + date-of-birth pair for a patient.
 * Falls back to the partial-DOB fields when the full `dateOfBirth` is
 * absent — year-only / month+year / day+month+year are all rendered as
 * best the data allows. Age is computed against today.
 */
export function formatPatientAgeDob(p: {
  dateOfBirth: Date | string | null | undefined;
  dobDay?: number | null;
  dobMonth?: number | null;
  dobYear?: number | null;
}): { age: number | null; display: string | null } {
  if (p.dateOfBirth) {
    return {
      age: calculateAge(p.dateOfBirth),
      display: formatDate(p.dateOfBirth),
    };
  }

  const d = p.dobDay ?? null;
  const m = p.dobMonth ?? null;
  const y = p.dobYear ?? null;

  if (d && m && y) {
    return {
      age: calculateAge(new Date(y, m - 1, d)),
      display: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
    };
  }

  if (m && y) {
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m) age -= 1;
    return {
      age: age >= 0 ? age : null,
      display: `${String(m).padStart(2, "0")}/${y}`,
    };
  }

  if (y) {
    const age = new Date().getFullYear() - y;
    return {
      age: age >= 0 ? age : null,
      display: String(y),
    };
  }

  return { age: null, display: null };
}
