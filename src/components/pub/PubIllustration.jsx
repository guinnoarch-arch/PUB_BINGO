// A simple generated pub-front illustration, unique to each pub, used until real photos arrive.
const PALETTES = [
  ["#1f3d2b", "#c8912e"], ["#5b1f1f", "#e0b75a"], ["#1d2f4f", "#d9a441"], ["#2e2a24", "#c7a15a"],
  ["#3b2f4a", "#e2b857"], ["#12423f", "#e6c170"], ["#4a2d16", "#f0c36b"], ["#283618", "#dda15e"]
];

function hash(text) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

export default function PubIllustration({ pub, className = "" }) {
  const h = hash(pub.id);
  const [wall, trim] = PALETTES[h % PALETTES.length];
  const windows = 2 + (h % 2);
  const initials = pub.name.replace(/^The\s+/i, "").split(/\s+/).filter(w => /^[A-Za-z]/.test(w) && !/^(and|of)$/i.test(w)).slice(0, 2).map(w => w[0]).join("");
  const width = 320;
  const winWidth = (width - 120) / windows - 12;

  return (
    <svg className={`pub-illustration ${className}`.trim()} viewBox="0 0 320 200" role="img" aria-label={`Illustration of ${pub.name}`}>
      <rect width="320" height="200" fill="#f3e6c8" />
      <rect x="0" y="0" width="320" height="200" fill={trim} opacity="0.18" />
      <rect x="20" y="30" width="280" height="170" fill={wall} />
      <rect x="20" y="30" width="280" height="10" fill={trim} />
      <rect x="30" y="52" width="260" height="30" rx="3" fill="#111" opacity="0.35" />
      <text x="160" y="73" textAnchor="middle" fill={trim} fontFamily="Georgia, serif" fontSize="17" fontWeight="700">
        {pub.name.length > 26 ? `${pub.name.slice(0, 25)}…` : pub.name}
      </text>
      {Array.from({ length: windows }, (_, i) => {
        const x = 40 + i * (winWidth + 12);
        return (
          <g key={i}>
            <rect x={x} y="98" width={winWidth} height="62" rx="4" fill="#f8d98a" opacity="0.9" />
            <rect x={x} y="98" width={winWidth} height="62" rx="4" fill="none" stroke={trim} strokeWidth="3" />
            <line x1={x + winWidth / 2} y1="98" x2={x + winWidth / 2} y2="160" stroke={trim} strokeWidth="2" />
            <line x1={x} y1="124" x2={x + winWidth} y2="124" stroke={trim} strokeWidth="2" />
          </g>
        );
      })}
      <rect x="240" y="98" width="42" height="102" rx="3" fill="#1a120c" />
      <rect x="240" y="98" width="42" height="102" rx="3" fill="none" stroke={trim} strokeWidth="3" />
      <circle cx="274" cy="152" r="3" fill={trim} />
      <line x1="300" y1="44" x2="316" y2="44" stroke="#222" strokeWidth="3" />
      <line x1="312" y1="44" x2="312" y2="54" stroke="#222" strokeWidth="2" />
      <rect x="298" y="54" width="22" height="30" rx="3" fill={trim} />
      <text x="309" y="74" textAnchor="middle" fill={wall} fontFamily="Georgia, serif" fontSize="11" fontWeight="700">{initials}</text>
      <rect x="20" y="190" width="280" height="10" fill="#1a120c" opacity="0.4" />
    </svg>
  );
}
