const MARK_TITLE = 'Vice to Value';

function svgProps(className, style, viewBox, label = MARK_TITLE) {
  return {
    className,
    style,
    viewBox,
    role: 'img',
    'aria-label': label,
    xmlns: 'http://www.w3.org/2000/svg',
  };
}

export function VtvMark({ className, style }) {
  return (
    <svg {...svgProps(className, style, '0 0 64 64')}>
      <rect
        x="5"
        y="5"
        width="54"
        height="54"
        rx="18"
        fill="var(--paper-2, #10241b)"
        stroke="var(--rule-2, rgba(232,239,224,0.22))"
        strokeWidth="1.5"
      />
      <path
        d="M18 20.5 29.5 45 46 18.5"
        fill="none"
        stroke="var(--money, #5ec48a)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 20.5 29.5 45"
        fill="none"
        stroke="var(--money-2, #d4a84a)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 20.5 29.5 45 46 18.5"
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VtvLogo({ className, style }) {
  return (
    <svg {...svgProps(className, style, '0 0 270 64')}>
      <VtvMark />
      <text
        x="76"
        y="31"
        fill="var(--ink, #e8efe0)"
        fontFamily="Newsreader, Georgia, serif"
        fontSize="25"
        fontWeight="650"
        letterSpacing="-0.7"
      >
        Vice to Value
      </text>
      <text
        x="78"
        y="49"
        fill="var(--money, #5ec48a)"
        fontFamily="Geist, ui-sans-serif, system-ui, sans-serif"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="2.1"
      >
        CUT TODAY · GROW TOMORROW
      </text>
    </svg>
  );
}
