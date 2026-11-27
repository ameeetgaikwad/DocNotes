import { DOCUMENT_STORAGE_CAP_BYTES } from "@docnotes/shared";

// Per-user storage overrides parsed from the STORAGE_OVERRIDES env var.
// Format: "<clerkUserId>:<bytes>,<clerkUserId>:<bytes>" — whitespace
// around separators is tolerated. Malformed entries are skipped silently
// at boot so one typo can't take the backend down; see the startup log
// below for what was parsed.
function parseOverrides(raw: string | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!raw) return map;
  for (const entry of raw.split(",")) {
    const [rawId, rawBytes] = entry.split(":");
    const userId = rawId?.trim();
    const bytes = Number(rawBytes?.trim());
    if (!userId || !Number.isFinite(bytes) || bytes <= 0) continue;
    map.set(userId, Math.floor(bytes));
  }
  return map;
}

const overrides = parseOverrides(process.env.STORAGE_OVERRIDES);

if (overrides.size > 0) {
  // One-line boot log so deploys can confirm the override list took
  // effect without echoing the raw env var.
  console.log(
    `[storage-cap] ${overrides.size} per-user override(s) active`,
  );
}

export function getStorageCapBytes(userId: string): number {
  return overrides.get(userId) ?? DOCUMENT_STORAGE_CAP_BYTES;
}
