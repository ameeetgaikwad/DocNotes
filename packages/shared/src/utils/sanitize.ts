// Strip invisible Unicode noise from free-text medical fields before
// they get persisted or rendered. Runs on client (onChange + save) and
// server (upsert + query results) as defense in depth.
//
// Root cause (Manoj msg 2200 + 2181): a specific Android IME on the
// doctor's phone injects Unicode format characters — most likely the
// Arabic Letter Mark (U+061C) or a Right-to-Left Override (U+202E) —
// into typed input. Those chars are visually invisible but flip the
// character order in downstream renderers ("Nise" → "esiN", full
// character reversal). They also break the input's own text rendering,
// making typing appear to go into a blank field.
//
// Strategy: strip everything in Unicode category "Cf" (Format) plus
// C0 control chars except tab and newline plus DEL. \p{Cf} is a single
// escape that covers ALL current and future format characters — RLM,
// LRM, RLE, RLO, LRE, LRO, PDF, ALM, directional isolates (LRI/RLI/
// FSI/PDI), zero-width joiners/non-joiners/space, BOM, and any others
// the Unicode consortium may add.
//
// Regex is built via string + RegExp so the source stays free of the
// literal invisible codepoints we're stripping. Ranges:
//   U+0000-U+0008 + U+000B-U+001F + U+007F  — C0 control chars minus
//     tab (U+0009) and newline (U+000A).
//   \p{Cf}                                   — all Unicode format chars.
const NOISE_SOURCE = "[\\u0000-\\u0008\\u000B-\\u001F\\u007F\\p{Cf}]";
const NOISE_REGEX = new RegExp(NOISE_SOURCE, "gu");

export function sanitizeFreeText(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(NOISE_REGEX, "");
}
