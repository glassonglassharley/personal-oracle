// Inline SVG so currentColor inherits the parent's CSS color,
// making the wordmark automatically adapt to dark and light themes.

export function VtvLogo({ className, style }) {
  return (
    <svg
      viewBox="0 0 260 72"
      fill="none"
      role="img"
      aria-label="Vice to Value"
      className={className}
      style={style}
    >
      <defs>
        <clipPath id="vtv-l"><polygon points="6,10 20,10 32,64 18,64"/></clipPath>
        <clipPath id="vtv-r"><polygon points="32,64 46,64 58,10 44,10"/></clipPath>
      </defs>

      {/* Left arm — charcoal, diagonal falling lines */}
      <polygon points="6,10 20,10 32,64 18,64" fill="#2C2C2A" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <g clipPath="url(#vtv-l)" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="22" y1="14" x2="9"  y2="34"/>
        <line x1="25" y1="30" x2="13" y2="53"/>
        <line x1="28" y1="48" x2="17" y2="66"/>
      </g>

      {/* Right arm — teal, rising bar chart */}
      <polygon points="32,64 46,64 58,10 44,10" fill="#0F6E56"/>
      <g clipPath="url(#vtv-r)" fill="rgba(255,255,255,0.26)">
        <rect x="34" y="52" width="3" height="12"/>
        <rect x="38" y="44" width="3" height="20"/>
        <rect x="42" y="32" width="3" height="32"/>
        <rect x="46" y="18" width="3" height="46"/>
      </g>

      {/* Divider */}
      <line x1="68" y1="18" x2="68" y2="54" stroke="currentColor" strokeWidth="0.5" opacity="0.18"/>

      {/* Wordmark — fill="currentColor" inherits theme ink color */}
      <text x="76" y="37"
        fontFamily="Geist, 'Helvetica Neue', Arial, sans-serif"
        fontSize="14" fontWeight="600" letterSpacing="3"
        fill="currentColor">VICE TO VALUE</text>
      <text x="76" y="51"
        fontFamily="Geist, 'Helvetica Neue', Arial, sans-serif"
        fontSize="7.5" fontWeight="400" letterSpacing="1.8"
        fill="currentColor" opacity="0.5">CUT TODAY. GROW TOMORROW.</text>
    </svg>
  );
}

export function VtvMark({ className, style }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Vice to Value"
      className={className}
      style={style}
    >
      <defs>
        <clipPath id="vtv-ml"><polygon points="6,6 20,6 32,60 18,60"/></clipPath>
        <clipPath id="vtv-mr"><polygon points="32,60 46,60 58,6 44,6"/></clipPath>
      </defs>

      <polygon points="6,6 20,6 32,60 18,60" fill="#2C2C2A" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <g clipPath="url(#vtv-ml)" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="21" y1="10" x2="8"  y2="30"/>
        <line x1="24" y1="26" x2="11" y2="48"/>
        <line x1="27" y1="43" x2="15" y2="62"/>
      </g>

      <polygon points="32,60 46,60 58,6 44,6" fill="#0F6E56"/>
      <g clipPath="url(#vtv-mr)" fill="rgba(255,255,255,0.26)">
        <rect x="34" y="48" width="3" height="12"/>
        <rect x="38" y="40" width="3" height="20"/>
        <rect x="42" y="28" width="3" height="32"/>
        <rect x="46" y="14" width="3" height="46"/>
      </g>
    </svg>
  );
}
