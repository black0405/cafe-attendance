// Inline SVG illustrations in the logo's palette (coffee brown, cream, leaf green).
// Inline so they work on an offline cafe laptop and scale to any size.

type Props = { className?: string };

// Coffee cup with steam in front of a wall clock, with leaves and the logo's green check.
export function CafeHero({ className }: Props) {
  return (
    <svg viewBox="0 0 400 320" className={className} role="img" aria-label="Coffee cup in front of a clock">
      <circle cx="200" cy="170" r="140" fill="#dcfce7" />
      <circle cx="200" cy="170" r="140" fill="none" stroke="#bbf7d0" strokeWidth="2" strokeDasharray="4 10" />

      {/* Clock */}
      <circle cx="275" cy="105" r="58" fill="#fff" stroke="#15803d" strokeWidth="8" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="275" y1="58" x2="275" y2={i % 3 === 0 ? 68 : 64}
          stroke="#15803d" strokeWidth={i % 3 === 0 ? 4 : 2} strokeLinecap="round"
          transform={`rotate(${i * 30} 275 105)`}
        />
      ))}
      <line x1="275" y1="105" x2="275" y2="75" stroke="#3f2415" strokeWidth="5" strokeLinecap="round" />
      <line x1="275" y1="105" x2="298" y2="116" stroke="#3f2415" strokeWidth="5" strokeLinecap="round" />
      <circle cx="275" cy="105" r="5" fill="#16a34a" />

      {/* Steam */}
      <g fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" opacity="0.7">
        <path d="M140 150 q-12 -18 0 -36 q12 -18 0 -36" />
        <path d="M172 146 q-12 -18 0 -36 q12 -18 0 -36" />
        <path d="M204 150 q-12 -18 0 -36 q12 -18 0 -36" />
      </g>

      {/* Saucer + cup */}
      <ellipse cx="172" cy="282" rx="112" ry="16" fill="#5b3219" />
      <ellipse cx="172" cy="276" rx="104" ry="13" fill="#fdf6ee" />
      <path d="M252 190 a34 34 0 1 1 -8 62" fill="none" stroke="#fdf6ee" strokeWidth="16" />
      <path d="M252 190 a34 34 0 1 1 -8 62" fill="none" stroke="#7a4420" strokeWidth="3" />
      <path d="M92 168 h160 l-14 82 a28 28 0 0 1 -28 24 h-76 a28 28 0 0 1 -28 -24 z" fill="#fdf6ee" stroke="#7a4420" strokeWidth="3" />
      <ellipse cx="172" cy="168" rx="80" ry="12" fill="#7a4420" />
      <path d="M104 206 h136" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />

      {/* Leaves */}
      <path d="M40 286 c10 -50 50 -70 90 -64 c-8 40 -44 70 -90 64 z" fill="#22c55e" />
      <path d="M40 286 c24 -20 50 -40 88 -62" stroke="#15803d" strokeWidth="3" fill="none" />
      <path d="M360 290 c-4 -44 -36 -66 -72 -64 c4 36 34 62 72 64 z" fill="#15803d" />
      <path d="M360 290 c-20 -20 -44 -44 -70 -62" stroke="#dcfce7" strokeWidth="3" fill="none" />

      {/* Check badge */}
      <circle cx="270" cy="232" r="30" fill="#22c55e" stroke="#fff" strokeWidth="6" />
      <path d="M256 232 l10 10 l19 -20" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Faint coffee beans + leaves, tiled as a page background.
export const patternBg = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>
      <g fill='none' stroke-width='2' opacity='0.06'>
        <ellipse cx='28' cy='30' rx='10' ry='14' transform='rotate(30 28 30)' stroke='#7a4420'/>
        <path d='M22 20 q10 10 12 20' stroke='#7a4420'/>
        <path d='M80 84 c4 -18 20 -26 34 -22 c-4 16 -18 26 -34 22 z' stroke='#15803d'/>
      </g>
    </svg>`
  )}")`,
};
