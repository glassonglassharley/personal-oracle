/* Cyberpunk realistic face portraits — 100×100 viewBox */

function BgGrad({ id, c1, c2 = '#040408' }) {
  return (
    <defs>
      <radialGradient id={`bg${id}`} cx="50%" cy="25%" r="72%">
        <stop offset="0" stopColor={c1} stopOpacity="0.6" />
        <stop offset="0.6" stopColor="#08040e" stopOpacity="0.95" />
        <stop offset="1" stopColor={c2} />
      </radialGradient>
      <filter id={`gf${id}`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="0.9" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id={`sf${id}`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  )
}

function CornerMarks({ c }) {
  return (
    <path
      d="M4 4 H18 M4 4 V18 M96 4 H82 M96 4 V18 M4 96 H18 M4 96 V82 M96 96 H82 M96 96 V82"
      stroke={c} strokeWidth="1.2" opacity="0.55" fill="none"
    />
  )
}

/* Reusable realistic eye — sclera, iris, pupil, highlight, eyelid lines */
function Eye({ cx, cy, iris = '#2a1008', sx = 7, sy = 4.5, glow }) {
  return (
    <>
      {glow && <ellipse cx={cx} cy={cy} rx={sx + 2} ry={sy + 1.5} fill={glow} opacity="0.35" />}
      <ellipse cx={cx} cy={cy} rx={sx} ry={sy} fill="#ddd4c0" />
      <circle cx={cx} cy={cy} r={sx * 0.67} fill={iris} />
      <circle cx={cx} cy={cy} r={sx * 0.36} fill="#060304" />
      <circle cx={cx - sx * 0.2} cy={cy - sy * 0.28} r={sx * 0.15} fill="white" opacity="0.92" />
      <ellipse cx={cx} cy={cy - sy * 0.9} rx={sx} ry={sy * 0.45} fill="#1a0c06" opacity="0.55" />
    </>
  )
}

/* 1 — PAYDAY PAT: wide dark face, snapback, smug smirk, gold tooth */
function Pat({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="PAYDAY PAT portrait">
      <BgGrad id={id} c1="#5c0018" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff003c" />

      {/* Neck */}
      <rect x="43" y="77" width="14" height="12" rx="2" fill="#3a1e0c" />

      {/* Head — wide face */}
      <ellipse cx="50" cy="52" rx="23" ry="25" fill="#3a1e0c" filter={`url(#gf${id})`} />

      {/* Snapback crown */}
      <path d="M27 38 Q28 20 50 17 Q72 20 73 38" fill="#150008" stroke="#ff003c" strokeWidth="1.2" />
      {/* Brim */}
      <rect x="19" y="36" width="62" height="7" rx="1" fill="#110006" stroke="#ff003c" strokeWidth="1" />
      <line x1="19" y1="40" x2="81" y2="40" stroke="#ff003c" strokeWidth="0.5" opacity="0.4" />
      {/* Sticker */}
      <rect x="55" y="27" width="11" height="7" rx="1" fill="#0a0208" stroke="#c9a84c" strokeWidth="0.8" />
      <text x="60" y="32.5" textAnchor="middle" fill="#c9a84c" fontSize="5" fontFamily="monospace" fontWeight="700">$</text>

      {/* Face shadow under brow */}
      <path d="M27 45 Q50 40 73 45" stroke="#1a0c06" strokeWidth="6" fill="none" opacity="0.3" strokeLinecap="round" />

      {/* Cheekbone highlights */}
      <ellipse cx="33" cy="54" rx="9" ry="6" fill="#4e2a14" opacity="0.45" />
      <ellipse cx="67" cy="54" rx="9" ry="6" fill="#4e2a14" opacity="0.45" />

      {/* Brows */}
      <path d="M30 45 Q39 41 46 43" stroke="#1a0a04" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M54 43 Q61 41 70 45" stroke="#1a0a04" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Eyes */}
      <Eye cx={39} cy={50} iris="#2a1008" sx={7} sy={4.5} />
      <Eye cx={61} cy={50} iris="#2a1008" sx={7} sy={4.5} />

      {/* Nose */}
      <path d="M46 55 Q43 60 41 63 M54 55 Q57 60 59 63" stroke="#1a0c06" strokeWidth="1" fill="none" opacity="0.5" />
      <ellipse cx="43" cy="64" rx="4" ry="2.2" fill="#1a0c06" opacity="0.45" />
      <ellipse cx="57" cy="64" rx="4" ry="2.2" fill="#1a0c06" opacity="0.45" />
      <path d="M39 63 Q50 66 61 63" stroke="#1a0c06" strokeWidth="0.7" fill="rgba(0,0,0,0.1)" />

      {/* Smirk */}
      <path d="M37 71 Q50 78 64 70" stroke="#1a0a04" strokeWidth="1.2" fill="#2e1408" strokeLinecap="round" />
      <path d="M37 71 Q50 69 64 70" stroke="#1a0a04" strokeWidth="0.9" fill="none" />
      {/* Gold tooth */}
      <rect x="47" y="71" width="5" height="4.5" rx="0.5" fill="#c9a84c" />
      <line x1="49.5" y1="71" x2="49.5" y2="75.5" stroke="#a07a2a" strokeWidth="0.6" opacity="0.6" />

      {/* Stubble */}
      <rect x="33" y="67" width="34" height="12" rx="3" fill="none" stroke="#1a0c06" strokeWidth="0.5" strokeDasharray="1.8 2.2" opacity="0.5" />

      {/* Collar */}
      <path d="M18 88 L30 74 H44 L50 80 L56 74 H70 L82 88" stroke="#ff003c" strokeWidth="1.5" fill="rgba(30,5,12,0.9)" strokeLinejoin="round" />
      <path d="M36 74 L50 79 L64 74" stroke="#ff003c" strokeWidth="1.1" fill="none" />

      <text x="50" y="97" textAnchor="middle" fill="#ff003c" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">PAT</text>
    </svg>
  )
}

/* 2 — KIKOFF KID: deep hood, only cyan eyes visible in shadow */
function Kid({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="KIKOFF KID portrait">
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="25%" r="72%">
          <stop offset="0" stopColor="#001a1a" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#020808" stopOpacity="0.97" />
          <stop offset="1" stopColor="#000408" />
        </radialGradient>
        <filter id={`cf${id}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`gf${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#00f5ff" />

      {/* Hood outer silhouette */}
      <path d="M6 65 Q8 8 50 3 Q92 8 94 65 Q74 24 50 22 Q26 24 6 65Z" fill="#030d0d" stroke="#00f5ff" strokeWidth="1.3" />
      {/* Hood inner shadow — deep darkness */}
      <ellipse cx="50" cy="44" rx="22" ry="20" fill="#010606" />

      {/* Faint glimpse of skin in shadow */}
      <ellipse cx="50" cy="50" rx="18" ry="16" fill="#3a2010" opacity="0.18" />

      {/* Hood texture folds */}
      <path d="M26 14 Q50 8 74 14" stroke="#00f5ff" strokeWidth="0.5" opacity="0.18" fill="none" />
      <path d="M16 32 Q50 20 84 32" stroke="#00f5ff" strokeWidth="0.4" opacity="0.12" fill="none" />
      <path d="M10 50 Q50 34 90 50" stroke="#00f5ff" strokeWidth="0.4" opacity="0.08" fill="none" />

      {/* Cyan eye glow halos */}
      <ellipse cx="37" cy="42" rx="12" ry="5" fill="#00f5ff" opacity="0.12" filter={`url(#cf${id})`} />
      <ellipse cx="63" cy="42" rx="12" ry="5" fill="#00f5ff" opacity="0.12" filter={`url(#cf${id})`} />

      {/* Cyan slit eyes */}
      <ellipse cx="37" cy="42" rx="8" ry="2.8" fill="#00f5ff" filter={`url(#cf${id})`} opacity="0.85" />
      <ellipse cx="37" cy="42" rx="8" ry="2.8" fill="#00f5ff" opacity="0.9" />
      <ellipse cx="37" cy="42" rx="3.5" ry="1.1" fill="#000c0c" />
      <ellipse cx="63" cy="42" rx="8" ry="2.8" fill="#00f5ff" filter={`url(#cf${id})`} opacity="0.85" />
      <ellipse cx="63" cy="42" rx="8" ry="2.8" fill="#00f5ff" opacity="0.9" />
      <ellipse cx="63" cy="42" rx="3.5" ry="1.1" fill="#000c0c" />

      {/* Faint mouth line in shadow */}
      <path d="M40 60 Q50 63 60 60" stroke="#00f5ff" strokeWidth="0.6" fill="none" opacity="0.25" />

      {/* Wiry torso/arms */}
      <path d="M34 82 L37 65 H63 L66 82" stroke="#00f5ff" strokeWidth="1.2" fill="rgba(0,10,14,0.7)" opacity="0.8" />
      <path d="M34 72 Q18 80 6 94" stroke="#00f5ff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M6 94 Q2 88 6 84 M6 94 Q0 86 5 82" stroke="#00f5ff" strokeWidth="1.1" fill="none" opacity="0.8" />
      <path d="M66 72 Q82 80 94 94" stroke="#00f5ff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M94 94 Q98 88 94 84 M94 94 Q100 86 95 82" stroke="#00f5ff" strokeWidth="1.1" fill="none" opacity="0.8" />

      <text x="50" y="97" textAnchor="middle" fill="#00f5ff" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2" opacity="0.8">KID</text>
    </svg>
  )
}

/* 3 — THE PINNACLE: cyber-enhanced pyramid skull, ashen pale, corporate suit */
function Pinnacle({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="THE PINNACLE portrait">
      <BgGrad id={id} c1="#3d2000" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff7c00" />

      {/* Neck */}
      <rect x="43" y="76" width="14" height="12" rx="1" fill="#2a1e18" />

      {/* Cybernetic pyramid skull — triangular head */}
      <polygon points="50,8 74,72 26,72" fill="#252018" stroke="#ff7c00" strokeWidth="1.2" filter={`url(#gf${id})`} />

      {/* Skull internal structure lines */}
      <line x1="50" y1="8" x2="50" y2="72" stroke="#ff7c00" strokeWidth="0.5" opacity="0.18" />
      <line x1="38" y1="40" x2="62" y2="40" stroke="#ff7c00" strokeWidth="0.4" opacity="0.12" />
      <line x1="34" y1="56" x2="66" y2="56" stroke="#ff7c00" strokeWidth="0.4" opacity="0.12" />

      {/* Skin — inset face area within the triangle */}
      <path d="M36 36 Q36 28 50 25 Q64 28 64 36 L62 60 Q57 68 50 69 Q43 68 38 60Z" fill="#2e2220" />

      {/* Cheekbone highlight */}
      <ellipse cx="38" cy="50" rx="6" ry="4" fill="#3e3028" opacity="0.6" />
      <ellipse cx="62" cy="50" rx="6" ry="4" fill="#3e3028" opacity="0.6" />

      {/* Brows — flat, cold */}
      <line x1="33" y1="40" x2="46" y2="40" stroke="#1a1410" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="54" y1="40" x2="67" y2="40" stroke="#1a1410" strokeWidth="2.5" strokeLinecap="round" />

      {/* Synthetic rectangular eyes — orange implants */}
      <rect x="30" y="43" width="14" height="8" rx="0.5" fill="#150e08" stroke="#ff7c00" strokeWidth="1.2" />
      <rect x="31" y="44" width="12" height="6" rx="0" fill="#ff7c00" opacity="0.75" />
      <rect x="31" y="44" width="6" height="6" fill="#0a0804" opacity="0.4" />
      <circle cx="34" cy="47" r="1.5" fill="white" opacity="0.35" />
      <rect x="56" y="43" width="14" height="8" rx="0.5" fill="#150e08" stroke="#ff7c00" strokeWidth="1.2" />
      <rect x="57" y="44" width="12" height="6" rx="0" fill="#ff7c00" opacity="0.75" />
      <rect x="57" y="44" width="6" height="6" fill="#0a0804" opacity="0.4" />
      <circle cx="60" cy="47" r="1.5" fill="white" opacity="0.35" />

      {/* Nose — sharp narrow */}
      <path d="M47 53 Q46 57 45 60 M53 53 Q54 57 55 60" stroke="#1a1410" strokeWidth="0.8" fill="none" opacity="0.5" />
      <ellipse cx="46" cy="61" rx="3" ry="1.8" fill="#1a1410" opacity="0.4" />
      <ellipse cx="54" cy="61" rx="3" ry="1.8" fill="#1a1410" opacity="0.4" />

      {/* Thin cold mouth — expressionless line */}
      <line x1="38" y1="66" x2="62" y2="66" stroke="#1a1410" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M38 66 Q50 64 62 66" stroke="#3e3028" strokeWidth="0.7" fill="none" opacity="0.5" />

      {/* Suit collar lapels */}
      <path d="M22 88 L32 72 H44 L50 80 L56 72 H68 L78 88" stroke="#ff7c00" strokeWidth="1.3" fill="rgba(25,12,0,0.9)" strokeLinejoin="round" />
      {/* Tie */}
      <path d="M46 80 L50 96 L54 80" stroke="#ff7c00" strokeWidth="1.2" fill="rgba(20,8,0,0.7)" />
      <line x1="48" y1="84" x2="52" y2="84" stroke="#ff7c00" strokeWidth="0.5" opacity="0.5" />
      <line x1="48" y1="88" x2="52" y2="88" stroke="#ff7c00" strokeWidth="0.5" opacity="0.4" />

      <text x="50" y="97" textAnchor="middle" fill="#ff7c00" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">PIN</text>
    </svg>
  )
}

/* 4 — AVANT GARDE: military, medium-dark skin, scar across face, beret, armor collar */
function Avant({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="AVANT GARDE portrait">
      <BgGrad id={id} c1="#4a0010" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff003c" />

      {/* Neck */}
      <rect x="43" y="77" width="14" height="12" rx="2" fill="#382010" />

      {/* Head */}
      <path d="M28 36 Q28 18 50 14 Q72 18 72 36 L70 64 Q64 76 50 78 Q36 76 30 64Z" fill="#382010" filter={`url(#gf${id})`} />

      {/* Military beret — offset left */}
      <path d="M20 32 Q18 14 38 11 Q58 9 68 22 Q60 26 50 26 Q36 26 24 32Z" fill="#1a0008" stroke="#ff003c" strokeWidth="1.2" />
      {/* Beret fold line */}
      <path d="M26 26 Q38 22 50 24" stroke="#ff003c" strokeWidth="0.5" opacity="0.3" fill="none" />
      {/* Star badge */}
      <circle cx="56" cy="18" r="4.5" fill="rgba(255,0,60,0.12)" stroke="#ff003c" strokeWidth="1" />
      <text x="56" y="21" textAnchor="middle" fill="#ff003c" fontSize="6" fontFamily="monospace">★</text>

      {/* Cheekbone highlights */}
      <ellipse cx="35" cy="52" rx="8" ry="5" fill="#4e2e18" opacity="0.5" />
      <ellipse cx="65" cy="52" rx="8" ry="5" fill="#4e2e18" opacity="0.5" />

      {/* Brows — angular/aggressive */}
      <path d="M30 42 L43 39" stroke="#1a0a04" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M57 39 L70 42" stroke="#1a0a04" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Eyes */}
      <Eye cx={39} cy={47} iris="#8b1a06" sx={7} sy={4.5} />
      <Eye cx={61} cy={47} iris="#8b1a06" sx={7} sy={4.5} />

      {/* Deep diagonal scar — cuts across right eye region */}
      <path d="M58 28 L44 72" stroke="#ff003c" strokeWidth="2.2" strokeLinecap="round" opacity="0.95" />
      <path d="M59 29 L45 73" stroke="#ff8080" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
      {/* Scar cross-crease detail */}
      <line x1="54" y1="44" x2="51" y2="47" stroke="#ff003c" strokeWidth="0.7" opacity="0.5" />

      {/* Nose */}
      <path d="M46 53 Q44 58 42 61 M54 53 Q56 58 58 61" stroke="#1a0c06" strokeWidth="0.9" fill="none" opacity="0.5" />
      <ellipse cx="43" cy="62" rx="3.5" ry="2" fill="#1a0c06" opacity="0.45" />
      <ellipse cx="57" cy="62" rx="3.5" ry="2" fill="#1a0c06" opacity="0.45" />

      {/* Stern mouth */}
      <path d="M36 68 Q50 66 64 68" stroke="#1a0a04" strokeWidth="1.5" fill="#2a1408" strokeLinecap="round" />
      <path d="M38 71 Q50 74 62 71" stroke="#1a0a04" strokeWidth="1" fill="none" />

      {/* Armor collar — high military */}
      <path d="M16 88 L28 72 H44 L50 80 L56 72 H72 L84 88" stroke="#ff003c" strokeWidth="1.5" fill="rgba(30,5,12,0.9)" strokeLinejoin="round" />
      <circle cx="28" cy="78" r="1.5" fill="#ff003c" opacity="0.7" />
      <circle cx="72" cy="78" r="1.5" fill="#ff003c" opacity="0.7" />

      <text x="50" y="97" textAnchor="middle" fill="#ff003c" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">AVG</text>
    </svg>
  )
}

/* 5 — CREDIT REAPER: corpse-pale face, skull war paint, hollow socket eyes, death grin */
function Reaper({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="CREDIT REAPER portrait">
      <BgGrad id={id} c1="#200030" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff003c" />

      {/* Neck */}
      <rect x="43" y="77" width="14" height="12" rx="2" fill="#1e1820" />

      {/* Head — slightly elongated */}
      <ellipse cx="50" cy="48" rx="21" ry="26" fill="#1e1820" filter={`url(#gf${id})`} />

      {/* Skull war paint — dark black around eyes and nose cavity */}
      <ellipse cx="36" cy="43" rx="11" ry="9" fill="#050208" opacity="0.9" />
      <ellipse cx="64" cy="43" rx="11" ry="9" fill="#050208" opacity="0.9" />
      {/* Nose cavity paint */}
      <path d="M44 54 L50 48 L56 54 L53 60 L47 60Z" fill="#050208" opacity="0.85" />

      {/* Eye socket glow — red from within the darkness */}
      <ellipse cx="36" cy="43" rx="7" ry="5.5" fill="#ff003c" opacity="0.2" filter={`url(#sf${id})`} />
      <ellipse cx="64" cy="43" rx="7" ry="5.5" fill="#ff003c" opacity="0.2" filter={`url(#sf${id})`} />

      {/* Sclera (hollow — very dark) */}
      <ellipse cx="36" cy="43" rx="7" ry="5" fill="#0a0208" />
      <ellipse cx="64" cy="43" rx="7" ry="5" fill="#0a0208" />
      {/* Red iris glow — large for direct stare */}
      <circle cx="36" cy="43" r="5.2" fill="#8b0020" />
      <circle cx="64" cy="43" r="5.2" fill="#8b0020" />
      <circle cx="36" cy="43" r="2.8" fill="#ff003c" opacity="0.85" />
      <circle cx="64" cy="43" r="2.8" fill="#ff003c" opacity="0.85" />
      <circle cx="34.2" cy="41.2" r="1.4" fill="#ff8080" opacity="0.65" />
      <circle cx="62.2" cy="41.2" r="1.4" fill="#ff8080" opacity="0.65" />

      {/* Cheekbone paint lines */}
      <path d="M26 48 L34 44" stroke="#ff003c" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <path d="M74 48 L66 44" stroke="#ff003c" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />

      {/* Teeth grin */}
      <path d="M32 66 Q50 74 68 66" stroke="#1a0818" strokeWidth="1.5" fill="#1a0818" />
      <path d="M32 66 Q50 62 68 66" stroke="#0a0408" strokeWidth="1" fill="none" />
      {/* Teeth */}
      <line x1="36" y1="66" x2="36" y2="71" stroke="#d0c8c0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="41" y1="67" x2="41" y2="73" stroke="#d0c8c0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="46" y1="68" x2="46" y2="74" stroke="#d0c8c0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="50" y1="68" x2="50" y2="74" stroke="#d0c8c0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="54" y1="68" x2="54" y2="74" stroke="#d0c8c0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="59" y1="67" x2="59" y2="73" stroke="#d0c8c0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="64" y1="66" x2="64" y2="71" stroke="#d0c8c0" strokeWidth="2.5" strokeLinecap="round" />

      {/* Vampire high collar */}
      <path d="M4 72 L18 50 L28 60 H72 L82 50 L96 72 Q72 64 50 68 Q28 64 4 72Z" fill="rgba(12,0,10,0.95)" stroke="#ff003c" strokeWidth="1.3" strokeLinejoin="round" />

      <text x="50" y="97" textAnchor="middle" fill="#ff003c" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">REAP</text>
    </svg>
  )
}

/* 6 — MISS LANE: warm dark skin, female, sharp angular bob, red eyes, diamond earrings */
function Lane({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="MISS LANE portrait">
      <BgGrad id={id} c1="#3d0018" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff003c" />

      {/* Neck */}
      <rect x="44" y="77" width="12" height="12" rx="2" fill="#3a1e0c" />

      {/* Sharp bob hair — geometric angular cut */}
      <path d="M18 62 L20 20 Q24 10 34 10 Q42 10 50 14" fill="#110008" stroke="#ff003c" strokeWidth="1.1" />
      <path d="M82 62 L80 20 Q76 10 66 10 Q58 10 50 14" fill="#110008" stroke="#ff003c" strokeWidth="1.1" />
      <rect x="20" y="10" width="60" height="14" rx="2" fill="#110008" stroke="#ff003c" strokeWidth="1" />

      {/* Head — slightly narrow */}
      <ellipse cx="50" cy="50" rx="19" ry="23" fill="#3a1e0c" filter={`url(#gf${id})`} />

      {/* Cheekbone highlights */}
      <ellipse cx="35" cy="52" rx="7" ry="5" fill="#502a14" opacity="0.5" />
      <ellipse cx="65" cy="52" rx="7" ry="5" fill="#502a14" opacity="0.5" />

      {/* Aggressive brows — sharp inward angle */}
      <path d="M30 42 L44 46" stroke="#1a0a04" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M56 46 L70 42" stroke="#1a0a04" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* Eyes — red iris, narrow/intense */}
      <Eye cx={39} cy={49} iris="#8b0020" sx={7} sy={4} />
      <Eye cx={61} cy={49} iris="#8b0020" sx={7} sy={4} />

      {/* Nose */}
      <path d="M46 55 Q44 59 42 62 M54 55 Q56 59 58 62" stroke="#1a0c06" strokeWidth="0.9" fill="none" opacity="0.5" />
      <ellipse cx="43" cy="63" rx="3.5" ry="2" fill="#1a0c06" opacity="0.45" />
      <ellipse cx="57" cy="63" rx="3.5" ry="2" fill="#1a0c06" opacity="0.45" />

      {/* Tight pursed mouth */}
      <path d="M37 69 Q44 66 50 68 Q56 66 63 69" stroke="#1a0a04" strokeWidth="1.2" fill="#2e1008" strokeLinecap="round" />
      <path d="M37 69 Q50 74 63 69" stroke="#1a0a04" strokeWidth="1" fill="none" />
      <path d="M42 71 Q50 73 58 71" stroke="#4e2018" strokeWidth="0.7" fill="none" />

      {/* Diamond earrings */}
      <polygon points="24,50 21,55 24,60 27,55" fill="none" stroke="#ff003c" strokeWidth="1.2" />
      <polygon points="24,50 21,55 24,60 27,55" fill="#ff003c" opacity="0.15" />
      <circle cx="24" cy="55" r="1" fill="#ff003c" opacity="0.6" />
      <polygon points="76,50 73,55 76,60 79,55" fill="none" stroke="#ff003c" strokeWidth="1.2" />
      <polygon points="76,50 73,55 76,60 79,55" fill="#ff003c" opacity="0.15" />
      <circle cx="76" cy="55" r="1" fill="#ff003c" opacity="0.6" />

      {/* Business collar */}
      <path d="M22 88 L32 74 H44 L50 80 L56 74 H68 L78 88" stroke="#ff003c" strokeWidth="1.4" fill="rgba(24,5,12,0.9)" strokeLinejoin="round" />

      <text x="50" y="97" textAnchor="middle" fill="#ff003c" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">LANE</text>
    </svg>
  )
}

/* 7 — SKY BARON: weathered tan skin, aviator goggles cover eyes (orange glow), stubble */
function SkyBaron({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="SKY BARON portrait">
      <BgGrad id={id} c1="#3a1800" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff7c00" />

      {/* Neck */}
      <rect x="43" y="77" width="14" height="12" rx="2" fill="#4a2e1a" />

      {/* Head */}
      <ellipse cx="50" cy="52" rx="21" ry="24" fill="#4a2e1a" filter={`url(#gf${id})`} />

      {/* Aviator cap */}
      <path d="M28 36 Q26 14 50 10 Q74 14 72 36 Q60 26 50 24 Q40 26 28 36Z" fill="#1e0e00" stroke="#ff7c00" strokeWidth="1.2" />
      {/* Cap center seam */}
      <line x1="50" y1="10" x2="50" y2="32" stroke="#ff7c00" strokeWidth="0.5" opacity="0.3" />
      {/* Cap strap lines */}
      <path d="M28 36 Q24 44 26 52" stroke="#ff7c00" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M72 36 Q76 44 74 52" stroke="#ff7c00" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Buckle left */}
      <rect x="22" y="42" width="6" height="4" rx="0.5" fill="none" stroke="#ff7c00" strokeWidth="1" />

      {/* Cheeks visible — weathered sun-damage */}
      <ellipse cx="35" cy="56" rx="8" ry="5" fill="#5e3e24" opacity="0.55" />
      <ellipse cx="65" cy="56" rx="8" ry="5" fill="#5e3e24" opacity="0.55" />

      {/* Brow ridge above goggles */}
      <path d="M26 44 Q50 39 74 44" stroke="#1a0e04" strokeWidth="5" fill="none" opacity="0.3" strokeLinecap="round" />

      {/* Aviator goggles — large round, orange lens glow */}
      <circle cx="37" cy="48" r="12" fill="rgba(20,10,0,0.9)" stroke="#ff7c00" strokeWidth="1.8" />
      <circle cx="63" cy="48" r="12" fill="rgba(20,10,0,0.9)" stroke="#ff7c00" strokeWidth="1.8" />
      {/* Goggle bridge */}
      <rect x="48" y="44" width="4" height="7" rx="1.5" fill="#1a0a00" stroke="#ff7c00" strokeWidth="1" />
      {/* Orange lens fill — layered glow */}
      <circle cx="37" cy="48" r="9.5" fill="rgba(255,124,0,0.1)" />
      <circle cx="63" cy="48" r="9.5" fill="rgba(255,124,0,0.1)" />
      <circle cx="37" cy="48" r="6" fill="rgba(255,124,0,0.22)" />
      <circle cx="63" cy="48" r="6" fill="rgba(255,124,0,0.22)" />
      <circle cx="37" cy="48" r="3.5" fill="#ff7c00" opacity="0.75" />
      <circle cx="63" cy="48" r="3.5" fill="#ff7c00" opacity="0.75" />
      {/* Lens glint */}
      <circle cx="33" cy="44" r="1.5" fill="#ffa040" opacity="0.65" />
      <circle cx="59" cy="44" r="1.5" fill="#ffa040" opacity="0.65" />
      {/* Goggle strap */}
      <rect x="6" y="45" width="16" height="6" rx="3" fill="#1e0e00" stroke="#ff7c00" strokeWidth="0.8" />
      <rect x="78" y="45" width="16" height="6" rx="3" fill="#1e0e00" stroke="#ff7c00" strokeWidth="0.8" />

      {/* Nose visible below goggles */}
      <path d="M46 61 Q44 65 42 67 M54 61 Q56 65 58 67" stroke="#1a0e04" strokeWidth="0.9" fill="none" opacity="0.5" />
      <ellipse cx="43" cy="68" rx="3.5" ry="2" fill="#1a0e04" opacity="0.4" />
      <ellipse cx="57" cy="68" rx="3.5" ry="2" fill="#1a0e04" opacity="0.4" />

      {/* Cocky smirk */}
      <path d="M36 73 Q48 80 64 74" stroke="#1a0e04" strokeWidth="1.3" fill="#3a2010" strokeLinecap="round" />
      <path d="M36 73 Q50 71 64 74" stroke="#1a0e04" strokeWidth="0.9" fill="none" />
      {/* Stubble */}
      <rect x="32" y="68" width="36" height="10" rx="3" fill="none" stroke="#1a0e04" strokeWidth="0.5" strokeDasharray="1.5 2.5" opacity="0.55" />

      {/* Baron high coat collar + epaulettes */}
      <path d="M14 88 L26 72 H40 L50 80 L60 72 H74 L86 88" stroke="#ff7c00" strokeWidth="1.5" fill="rgba(25,12,0,0.9)" strokeLinejoin="round" />
      <rect x="10" y="78" width="14" height="8" rx="1" fill="rgba(255,124,0,0.1)" stroke="#ff7c00" strokeWidth="1" />
      <rect x="76" y="78" width="14" height="8" rx="1" fill="rgba(255,124,0,0.1)" stroke="#ff7c00" strokeWidth="1" />
      <line x1="10" y1="82" x2="24" y2="82" stroke="#ff7c00" strokeWidth="0.6" opacity="0.5" />
      <line x1="76" y1="82" x2="90" y2="82" stroke="#ff7c00" strokeWidth="0.6" opacity="0.5" />

      <text x="50" y="97" textAnchor="middle" fill="#ff7c00" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">SKY</text>
    </svg>
  )
}

/* 8 — CAP ONE ALPHA: full sealed combat helmet, red visor slit, shoulder armor */
function Alpha({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="CAP ONE ALPHA portrait">
      <BgGrad id={id} c1="#4a0018" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff003c" />

      {/* Helmet dome */}
      <path d="M22 44 Q22 12 50 8 Q78 12 78 44 V62 H22Z" fill="#0e0208" stroke="#ff003c" strokeWidth="1.5" filter={`url(#gf${id})`} />

      {/* Helmet panel detail lines */}
      <line x1="50" y1="8" x2="50" y2="62" stroke="#ff003c" strokeWidth="0.5" opacity="0.2" />
      <path d="M34 14 Q50 10 66 14" stroke="#ff003c" strokeWidth="0.5" opacity="0.2" fill="none" />
      <path d="M28 28 Q50 22 72 28" stroke="#ff003c" strokeWidth="0.5" opacity="0.15" fill="none" />
      <path d="M24 44 Q50 38 76 44" stroke="#ff003c" strokeWidth="0.5" opacity="0.12" fill="none" />

      {/* Visor slit — wide red glow */}
      <rect x="22" y="40" width="56" height="10" rx="1" fill="#020108" stroke="#ff003c" strokeWidth="1.2" />
      <rect x="23" y="41" width="54" height="8" rx="0.5" fill="#ff003c" opacity="0.5" />
      {/* Visor scanline */}
      <line x1="23" y1="45" x2="77" y2="45" stroke="#ff003c" strokeWidth="0.6" opacity="0.5" />
      {/* Visor glow highlight top */}
      <rect x="23" y="41" width="54" height="2.5" rx="0" fill="#ff8080" opacity="0.25" />

      {/* Chin guard */}
      <path d="M26 62 L30 72 H70 L74 62" fill="#0e0208" stroke="#ff003c" strokeWidth="1.2" />
      <line x1="26" y1="67" x2="74" y2="67" stroke="#ff003c" strokeWidth="0.5" opacity="0.3" />

      {/* Side panel vents */}
      <line x1="22" y1="48" x2="14" y2="52" stroke="#ff003c" strokeWidth="1" />
      <line x1="22" y1="54" x2="14" y2="58" stroke="#ff003c" strokeWidth="0.7" opacity="0.5" />
      <line x1="78" y1="48" x2="86" y2="52" stroke="#ff003c" strokeWidth="1" />
      <line x1="78" y1="54" x2="86" y2="58" stroke="#ff003c" strokeWidth="0.7" opacity="0.5" />

      {/* Alpha symbol on forehead */}
      <text x="50" y="36" textAnchor="middle" fill="#ff003c" fontSize="12" fontFamily="monospace" fontWeight="700" opacity="0.4">α</text>

      {/* Shoulder armor — heavy plates */}
      <path d="M8 72 L22 62 H34 V80 H8Z" fill="rgba(255,0,60,0.08)" stroke="#ff003c" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M92 72 L78 62 H66 V80 H92Z" fill="rgba(255,0,60,0.08)" stroke="#ff003c" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="8" y1="71" x2="34" y2="71" stroke="#ff003c" strokeWidth="0.5" opacity="0.4" />
      <line x1="66" y1="71" x2="92" y2="71" stroke="#ff003c" strokeWidth="0.5" opacity="0.4" />
      <circle cx="14" cy="66" r="2" fill="rgba(255,0,60,0.3)" stroke="#ff003c" strokeWidth="0.8" />
      <circle cx="86" cy="66" r="2" fill="rgba(255,0,60,0.3)" stroke="#ff003c" strokeWidth="0.8" />

      {/* Chest/collar */}
      <path d="M34 80 L38 72 H62 L66 80" stroke="#ff003c" strokeWidth="1" fill="#0a0208" />

      <text x="50" y="97" textAnchor="middle" fill="#ff003c" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">α</text>
    </svg>
  )
}

/* 9 — CAP ONE BETA: same combat helmet, cyan visor, antenna, angular armor */
function Beta({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="CAP ONE BETA portrait">
      <BgGrad id={id} c1="#00203a" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#00f5ff" />

      {/* Antenna */}
      <line x1="50" y1="8" x2="50" y2="2" stroke="#00f5ff" strokeWidth="1.5" />
      <circle cx="50" cy="2" r="2" fill="#00f5ff" />
      <circle cx="50" cy="2" r="4" fill="none" stroke="#00f5ff" strokeWidth="0.6" opacity="0.4" />

      {/* Helmet dome — slightly wider */}
      <path d="M20 44 Q20 12 50 8 Q80 12 80 44 V64 H20Z" fill="#000e14" stroke="#00f5ff" strokeWidth="1.5" filter={`url(#gf${id})`} />

      {/* Panel lines */}
      <line x1="50" y1="8" x2="50" y2="64" stroke="#00f5ff" strokeWidth="0.5" opacity="0.2" />
      <path d="M32 14 Q50 10 68 14" stroke="#00f5ff" strokeWidth="0.5" opacity="0.2" fill="none" />
      <path d="M26 30 Q50 24 74 30" stroke="#00f5ff" strokeWidth="0.5" opacity="0.15" fill="none" />

      {/* Cyan visor — taller than Alpha */}
      <rect x="20" y="38" width="60" height="14" rx="1.5" fill="#020e14" stroke="#00f5ff" strokeWidth="1.3" />
      <rect x="21" y="39" width="58" height="12" rx="1" fill="#00f5ff" opacity="0.42" />
      <line x1="21" y1="45" x2="79" y2="45" stroke="#00f5ff" strokeWidth="0.6" opacity="0.5" />
      <rect x="21" y="39" width="58" height="3" rx="0" fill="#80ffff" opacity="0.22" />

      {/* Beta symbol */}
      <text x="50" y="36" textAnchor="middle" fill="#00f5ff" fontSize="12" fontFamily="monospace" fontWeight="700" opacity="0.38">β</text>

      {/* Chin guard */}
      <path d="M24 64 L28 74 H72 L76 64" fill="#000e14" stroke="#00f5ff" strokeWidth="1.2" />
      <line x1="24" y1="69" x2="76" y2="69" stroke="#00f5ff" strokeWidth="0.5" opacity="0.3" />

      {/* Side cables */}
      <path d="M20 48 Q12 52 10 60" stroke="#00f5ff" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M80 48 Q88 52 90 60" stroke="#00f5ff" strokeWidth="1.1" fill="none" strokeLinecap="round" />

      {/* Angular shoulder armor — more aggressive than Alpha */}
      <polygon points="4,78 20,64 32,64 32,82 4,82" fill="rgba(0,245,255,0.06)" stroke="#00f5ff" strokeWidth="1.2" />
      <polygon points="96,78 80,64 68,64 68,82 96,82" fill="rgba(0,245,255,0.06)" stroke="#00f5ff" strokeWidth="1.2" />
      <line x1="4" y1="73" x2="32" y2="73" stroke="#00f5ff" strokeWidth="0.5" opacity="0.4" />
      <line x1="68" y1="73" x2="96" y2="73" stroke="#00f5ff" strokeWidth="0.5" opacity="0.4" />
      <circle cx="10" cy="68" r="1.8" fill="rgba(0,245,255,0.3)" stroke="#00f5ff" strokeWidth="0.8" />
      <circle cx="90" cy="68" r="1.8" fill="rgba(0,245,255,0.3)" stroke="#00f5ff" strokeWidth="0.8" />

      {/* Chest */}
      <path d="M32 82 L36 74 H64 L68 82" stroke="#00f5ff" strokeWidth="1" fill="#000e14" />

      <text x="50" y="97" textAnchor="middle" fill="#00f5ff" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">β</text>
    </svg>
  )
}

/* 10 — LEAD WEIGHT: very dark skin, brutish wide face, heavy brow, massive jaw, hulk shoulders */
function LeadWeight({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="LEAD WEIGHT portrait">
      <BgGrad id={id} c1="#300010" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#ff003c" />

      {/* Neck — very thick */}
      <rect x="38" y="74" width="24" height="14" rx="2" fill="#1e0e08" />

      {/* Head — extremely wide */}
      <ellipse cx="50" cy="48" rx="28" ry="24" fill="#1e0e08" filter={`url(#gf${id})`} />

      {/* Heavy orbital brow plate */}
      <path d="M18 40 Q50 32 82 40 L80 48 Q50 42 20 48Z" fill="#140a06" stroke="#ff003c" strokeWidth="1.2" />
      {/* Brow rivets */}
      <circle cx="24" cy="44" r="2" fill="#ff003c" opacity="0.7" />
      <circle cx="34" cy="41" r="2" fill="#ff003c" opacity="0.7" />
      <circle cx="50" cy="40" r="2.5" fill="#ff003c" opacity="0.5" stroke="#ff003c" strokeWidth="0.8" />
      <circle cx="66" cy="41" r="2" fill="#ff003c" opacity="0.7" />
      <circle cx="76" cy="44" r="2" fill="#ff003c" opacity="0.7" />

      {/* Small intense eyes — barely visible under heavy brow */}
      <ellipse cx="37" cy="50" rx="6" ry="3.5" fill="#1a0a06" />
      <circle cx="37" cy="50" r="4.2" fill="#8b0020" />
      <circle cx="37" cy="50" r="2.2" fill="#ff003c" opacity="0.8" />
      <circle cx="35.5" cy="48.6" r="1" fill="white" opacity="0.7" />
      <ellipse cx="63" cy="50" rx="6" ry="3.5" fill="#1a0a06" />
      <circle cx="63" cy="50" r="4.2" fill="#8b0020" />
      <circle cx="63" cy="50" r="2.2" fill="#ff003c" opacity="0.8" />
      <circle cx="61.5" cy="48.6" r="1" fill="white" opacity="0.7" />

      {/* Cheek mass */}
      <ellipse cx="30" cy="56" rx="10" ry="7" fill="#2e1a10" opacity="0.6" />
      <ellipse cx="70" cy="56" rx="10" ry="7" fill="#2e1a10" opacity="0.6" />

      {/* Massive wide nose */}
      <path d="M45 55 Q42 60 38 63 M55 55 Q58 60 62 63" stroke="#1a0c06" strokeWidth="1.2" fill="none" opacity="0.5" />
      <ellipse cx="40" cy="64" rx="5" ry="2.8" fill="#1a0c06" opacity="0.5" />
      <ellipse cx="60" cy="64" rx="5" ry="2.8" fill="#1a0c06" opacity="0.5" />
      <path d="M35 63 Q50 67 65 63" stroke="#1a0c06" strokeWidth="0.9" fill="rgba(0,0,0,0.15)" />

      {/* Snarl / grimace */}
      <path d="M32 70 Q50 68 68 70" stroke="#1a0c06" strokeWidth="2" fill="#1a0c06" strokeLinecap="round" />
      <path d="M32 70 Q50 75 68 70" stroke="#1a0c06" strokeWidth="1.2" fill="none" />
      {/* Teeth — clenched */}
      <line x1="38" y1="70" x2="38" y2="73" stroke="#c8c0b8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="43" y1="70" x2="43" y2="74" stroke="#c8c0b8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="50" y1="70" x2="50" y2="74" stroke="#c8c0b8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="57" y1="70" x2="57" y2="74" stroke="#c8c0b8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="62" y1="70" x2="62" y2="73" stroke="#c8c0b8" strokeWidth="2.5" strokeLinecap="round" />

      {/* Absolutely massive shoulders */}
      <path d="M0 82 L10 68 H36 V88 H0Z" fill="rgba(30,5,12,0.9)" stroke="#ff003c" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M100 82 L90 68 H64 V88 H100Z" fill="rgba(30,5,12,0.9)" stroke="#ff003c" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="0" y1="75" x2="36" y2="75" stroke="#ff003c" strokeWidth="0.7" opacity="0.4" />
      <line x1="64" y1="75" x2="100" y2="75" stroke="#ff003c" strokeWidth="0.7" opacity="0.4" />
      {/* Center chest */}
      <rect x="36" y="74" width="28" height="14" rx="1" fill="rgba(20,5,8,0.8)" stroke="#ff003c" strokeWidth="1" />
      <text x="50" y="84" textAnchor="middle" fill="#ff003c" fontSize="8" fontFamily="monospace" opacity="0.3">⊕</text>

      <text x="50" y="97" textAnchor="middle" fill="#ff003c" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">LEAD</text>
    </svg>
  )
}

/* 11 — THE MAINFRAME: left side organic, right side cybernetic — split face hybrid */
function Mainframe({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="THE MAINFRAME portrait">
      <BgGrad id={id} c1="#002030" />
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      <CornerMarks c="#00f5ff" />

      {/* Antenna */}
      <line x1="65" y1="14" x2="72" y2="4" stroke="#00f5ff" strokeWidth="1.3" />
      <circle cx="72" cy="4" r="2" fill="#00f5ff" opacity="0.8" />
      <circle cx="72" cy="4" r="4" fill="none" stroke="#00f5ff" strokeWidth="0.6" opacity="0.4" />

      {/* Neck */}
      <rect x="43" y="77" width="14" height="12" rx="2" fill="#1e1c24" />

      {/* Head — slightly angular */}
      <path d="M28 36 Q28 16 50 12 Q72 16 72 36 L70 68 Q64 78 50 80 Q36 78 30 68Z" fill="#1e1c24" filter={`url(#gf${id})`} />

      {/* Vertical split line — divides organic left from cyber right */}
      <line x1="50" y1="12" x2="50" y2="80" stroke="#00f5ff" strokeWidth="1.2" opacity="0.55" />

      {/* LEFT side — organic pale skin */}
      <path d="M28 36 Q28 16 50 12 L50 80 Q36 78 30 68Z" fill="#2e2a34" opacity="0.6" />

      {/* RIGHT side — metal/chrome panel */}
      <path d="M50 12 Q72 16 72 36 L70 68 Q64 78 50 80Z" fill="#1a2028" opacity="0.7" />
      {/* Metal panel rivets */}
      <circle cx="60" cy="22" r="1.2" fill="#00f5ff" opacity="0.5" />
      <circle cx="67" cy="36" r="1.2" fill="#00f5ff" opacity="0.5" />
      <circle cx="66" cy="52" r="1.2" fill="#00f5ff" opacity="0.5" />
      {/* Circuit traces on right side */}
      <path d="M50 30 H64 M64 30 V40 M50 48 H60 M60 48 H66" stroke="#00f5ff" strokeWidth="0.7" opacity="0.45" fill="none" />

      {/* LEFT brow — organic */}
      <path d="M30 40 Q39 36 47 38" stroke="#1e1620" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {/* RIGHT brow — chrome implant bar */}
      <rect x="53" y="37" width="16" height="2.5" rx="0.5" fill="#00f5ff" opacity="0.6" />

      {/* LEFT eye — organic, pale iris */}
      <Eye cx={38} cy={47} iris="#2a3040" sx={7} sy={4.5} />
      {/* Cybernetic ring implant around left eye */}
      <circle cx="38" cy="47" r="9" fill="none" stroke="#00f5ff" strokeWidth="0.7" opacity="0.4" />

      {/* RIGHT eye — screen display */}
      <rect x="54" y="42" width="16" height="10" rx="1" fill="#020e14" stroke="#00f5ff" strokeWidth="1.2" />
      <rect x="55" y="43" width="14" height="8" rx="0.5" fill="#00f5ff" opacity="0.55" />
      {/* Scanlines */}
      <line x1="55" y1="45" x2="69" y2="45" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" />
      <line x1="55" y1="47.5" x2="69" y2="47.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" />
      <line x1="55" y1="50" x2="69" y2="50" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" />
      <rect x="55" y="43" width="5" height="2.5" rx="0" fill="#80ffff" opacity="0.35" />

      {/* Nose — left side organic, right side plate */}
      <path d="M46 53 Q44 58 42 61" stroke="#1e1c24" strokeWidth="0.9" fill="none" opacity="0.5" />
      <ellipse cx="43" cy="62" rx="3.5" ry="2" fill="#1e1c24" opacity="0.45" />
      <rect x="53" y="55" width="8" height="10" rx="0.5" fill="rgba(0,245,255,0.06)" stroke="#00f5ff" strokeWidth="0.6" />

      {/* Mouth — left organic, right data bar */}
      <path d="M34 68 Q42 72 50 70" stroke="#1e1c24" strokeWidth="1.2" fill="#28283a" strokeLinecap="round" />
      <path d="M34 68 Q42 66 50 68" stroke="#1e1c24" strokeWidth="0.8" fill="none" />
      <rect x="50" y="67" width="18" height="5" rx="0.5" fill="rgba(0,245,255,0.12)" stroke="#00f5ff" strokeWidth="0.8" />
      <rect x="50" y="67" width="9" height="5" rx="0.5" fill="#00f5ff" opacity="0.45" />

      {/* Collar — server rack style */}
      <path d="M24 88 L32 76 H44 L50 82 L56 76 H68 L76 88" stroke="#00f5ff" strokeWidth="1.3" fill="rgba(2,14,20,0.9)" strokeLinejoin="round" />

      <text x="50" y="97" textAnchor="middle" fill="#00f5ff" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">MAIN</text>
    </svg>
  )
}

/* 12 — THE APPLE BOSS: commanding wide face, 5-pt crown, gold eyes, cape collar, gold glow border */
function Boss({ id }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="THE APPLE BOSS portrait">
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="20%" r="80%">
          <stop offset="0" stopColor="#4a3200" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#1a1000" stopOpacity="0.95" />
          <stop offset="1" stopColor="#040408" />
        </radialGradient>
        <radialGradient id={`crown${id}`} cx="50%" cy="0%" r="100%">
          <stop offset="0" stopColor="#c9a84c" stopOpacity="0.95" />
          <stop offset="1" stopColor="#7a6020" stopOpacity="0.5" />
        </radialGradient>
        <filter id={`gf${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`glow${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" fill={`url(#bg${id})`} />
      {/* Gold glow border */}
      <rect x="2" y="2" width="96" height="96" fill="none" stroke="#c9a84c" strokeWidth="2.5" opacity="0.3" filter={`url(#glow${id})`} />
      <CornerMarks c="#c9a84c" />

      {/* Neck — imposing */}
      <rect x="41" y="76" width="18" height="12" rx="2" fill="#3a2010" />

      {/* Crown base plate */}
      <rect x="22" y="18" width="56" height="8" rx="1" fill="#100a04" stroke="#c9a84c" strokeWidth="1.4" />
      {/* Crown 5 spikes */}
      <polygon points="24,18 24,6 30,12 36,2 42,12 50,4 58,12 64,2 70,12 76,6 76,18" fill={`url(#crown${id})`} stroke="#c9a84c" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Spike dividers */}
      <line x1="30" y1="18" x2="30" y2="12" stroke="#c9a84c" strokeWidth="0.6" opacity="0.4" />
      <line x1="42" y1="18" x2="42" y2="12" stroke="#c9a84c" strokeWidth="0.6" opacity="0.4" />
      <line x1="58" y1="18" x2="58" y2="12" stroke="#c9a84c" strokeWidth="0.6" opacity="0.4" />
      <line x1="70" y1="18" x2="70" y2="12" stroke="#c9a84c" strokeWidth="0.6" opacity="0.4" />
      {/* Gem jewels */}
      <circle cx="36" cy="6" r="2.5" fill="#ff003c" stroke="#c9a84c" strokeWidth="0.8" />
      <circle cx="50" cy="4" r="3" fill="#00f5ff" stroke="#c9a84c" strokeWidth="0.8" />
      <circle cx="64" cy="6" r="2.5" fill="#ff003c" stroke="#c9a84c" strokeWidth="0.8" />
      <circle cx="35" cy="5.5" r="0.8" fill="white" opacity="0.7" />
      <circle cx="49" cy="3.5" r="0.9" fill="white" opacity="0.7" />
      <circle cx="63" cy="5.5" r="0.8" fill="white" opacity="0.7" />

      {/* Head — wide, commanding */}
      <ellipse cx="50" cy="50" rx="24" ry="26" fill="#3a2010" filter={`url(#gf${id})`} />

      {/* Cheekbone highlights — regal */}
      <ellipse cx="33" cy="54" rx="10" ry="7" fill="#4e2e18" opacity="0.5" />
      <ellipse cx="67" cy="54" rx="10" ry="7" fill="#4e2e18" opacity="0.5" />

      {/* Strong brow ridge */}
      <path d="M24 44 Q50 37 76 44" stroke="#1a0e04" strokeWidth="7" fill="none" opacity="0.3" strokeLinecap="round" />
      {/* Brows — thick, dominant */}
      <path d="M26 44 Q38 39 46 42" stroke="#1a0a04" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M54 42 Q62 39 74 44" stroke="#1a0a04" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* Eyes — gold iris, commanding */}
      <Eye cx={38} cy={50} iris="#8a6010" sx={7.5} sy={5} />
      {/* Gold iris glow over top */}
      <circle cx="38" cy="50" r="3.8" fill="rgba(201,168,76,0.35)" />
      <Eye cx={62} cy={50} iris="#8a6010" sx={7.5} sy={5} />
      <circle cx="62" cy="50" r="3.8" fill="rgba(201,168,76,0.35)" />

      {/* Prominent nose */}
      <path d="M46 57 Q43 62 40 65 M54 57 Q57 62 60 65" stroke="#1a0e04" strokeWidth="1.1" fill="none" opacity="0.5" />
      <ellipse cx="41" cy="66" rx="4.5" ry="2.5" fill="#1a0e04" opacity="0.45" />
      <ellipse cx="59" cy="66" rx="4.5" ry="2.5" fill="#1a0e04" opacity="0.45" />
      <path d="M36 65 Q50 69 64 65" stroke="#1a0e04" strokeWidth="0.9" fill="rgba(0,0,0,0.1)" />

      {/* Stern commanding mouth */}
      <path d="M34 73 Q50 70 66 73" stroke="#1a0a04" strokeWidth="1.5" fill="#2e1808" strokeLinecap="round" />
      <path d="M34 73 Q50 78 66 73" stroke="#1a0a04" strokeWidth="1.2" fill="none" />
      <path d="M38 75 Q50 77 62 75" stroke="#4e2818" strokeWidth="0.8" fill="none" />

      {/* Command symbol on forehead */}
      <text x="50" y="36" textAnchor="middle" fill="#c9a84c" fontSize="9" fontFamily="monospace" fontWeight="700" opacity="0.35">⌘</text>

      {/* Imposing cape collar */}
      <path d="M4 88 L16 70 H30 L50 80 L70 70 H84 L96 88 Q68 80 50 84 Q32 80 4 88Z" fill="rgba(20,14,4,0.95)" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="4" y1="88" x2="50" y2="82" stroke="#c9a84c" strokeWidth="0.6" opacity="0.3" />
      <line x1="96" y1="88" x2="50" y2="82" stroke="#c9a84c" strokeWidth="0.6" opacity="0.3" />

      <text x="50" y="97" textAnchor="middle" fill="#c9a84c" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="2">BOSS</text>
    </svg>
  )
}

const PORTRAIT_MAP = {
  1: Pat, 2: Kid, 3: Pinnacle, 4: Avant, 5: Reaper, 6: Lane,
  7: SkyBaron, 8: Alpha, 9: Beta, 10: LeadWeight, 11: Mainframe, 12: Boss,
}

export default function VillainPortrait({ villainId, featured = false, eliminated = false, isTarget = false, isBoss = false }) {
  const id = villainId ?? 1
  const Component = PORTRAIT_MAP[id] ?? Pat

  const frameClass = [
    'portrait-frame',
    featured ? 'pf-featured' : '',
    eliminated ? 'pf-eliminated' : isTarget ? 'pf-target' : isBoss ? 'pf-boss' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={frameClass}>
      <div className="pf-corner tl" />
      <div className="pf-corner tr" />
      <div className="pf-corner bl" />
      <div className="pf-corner br" />
      <div className="pf-vignette" />
      {!eliminated && <div className="pf-scan" />}
      <Component id={id} />
    </div>
  )
}
