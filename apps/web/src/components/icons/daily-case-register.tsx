interface Props {
  className?: string;
}

/**
 * Custom open-book icon for the Register bottom-tab — replaces the
 * generic lucide BookOpen so the Daily Case Register's purpose reads
 * at a glance. "Daily" sits on the left page, "Case" on the right.
 *
 * Text is intentionally small for tab-bar use; the layout (two facing
 * pages with the words) is what makes it recognisable even before the
 * letters become legible.
 */
export function DailyCaseRegisterIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Page backdrops — soft fill so the icon pops vs. plain-line peers */}
      <path
        d="M2.5 5.5 H11 V18.5 H2.5 Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M13 5.5 H21.5 V18.5 H13 Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* Page borders */}
      <path
        d="M2.5 5.5 H11 V18.5 H2.5 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13 5.5 H21.5 V18.5 H13 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Spine */}
      <line
        x1="12"
        y1="4.5"
        x2="12"
        y2="19.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Page labels */}
      <text
        x="6.75"
        y="13.6"
        fontSize="3.4"
        textAnchor="middle"
        fill="currentColor"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        Daily
      </text>
      <text
        x="17.25"
        y="13.6"
        fontSize="3.4"
        textAnchor="middle"
        fill="currentColor"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        Case
      </text>
    </svg>
  );
}
