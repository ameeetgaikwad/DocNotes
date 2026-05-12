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
