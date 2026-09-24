import { useMemo, useState } from "react";
import { formatPrice } from "../../lib/core/prices.js";

const W = 320;
const H = 120;
const PAD = { top: 12, right: 12, bottom: 22, left: 40 };

const shortDate = t => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// A small line chart of a drink's price over time (one series, so no legend). Hover or tap a point
// for its value; the history list below is the table view.
export default function PriceChart({ points, label = "Price over time" }) {
  const [active, setActive] = useState(null);
  const data = useMemo(() => (points || [])
    .map(p => ({ t: new Date(p.at).getTime(), v: Number(p.price) }))
    .filter(p => Number.isFinite(p.t) && p.v > 0)
    .sort((a, b) => a.t - b.t), [points]);
  if (data.length < 2) return null;

  const minT = data[0].t;
  const maxT = data[data.length - 1].t;
  const minV = Math.min(...data.map(p => p.v));
  const maxV = Math.max(...data.map(p => p.v));
  const pad = Math.max(0.1, (maxV - minV) * 0.15);
  const lo = Math.max(0, minV - pad);
  const hi = maxV + pad;
  const x = t => PAD.left + (maxT === minT ? 0.5 : (t - minT) / (maxT - minT)) * (W - PAD.left - PAD.right);
  const y = v => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  // Prices hold until the next report, so the line steps.
  let path = `M${x(data[0].t)},${y(data[0].v)}`;
  for (let i = 1; i < data.length; i += 1) path += ` H${x(data[i].t)} V${y(data[i].v)}`;
  const shown = active != null ? data[active] : null;

  return (
    <figure className="price-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${label}: from ${formatPrice(data[0].v)} on ${shortDate(data[0].t)} to ${formatPrice(data[data.length - 1].v)} on ${shortDate(maxT)}`}>
        {[lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map(v => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart-axis" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{formatPrice(v)}</text>
          </g>
        ))}
        <text className="chart-axis" x={PAD.left} y={H - 6}>{shortDate(minT)}</text>
        <text className="chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">{shortDate(maxT)}</text>
        <path className="chart-line" d={path} />
        {data.map((p, i) => (
          <g key={`${p.t}-${i}`}>
            <circle className={`chart-dot ${active === i ? "active" : ""}`} cx={x(p.t)} cy={y(p.v)} r={active === i ? 5 : 4} />
            <circle
              className="chart-hit" cx={x(p.t)} cy={y(p.v)} r={12} tabIndex={0} role="button"
              aria-label={`${formatPrice(p.v)} on ${shortDate(p.t)}`}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)}
            />
          </g>
        ))}
        {shown && (
          <g className="chart-tip" transform={`translate(${Math.min(Math.max(x(shown.t), PAD.left + 40), W - PAD.right - 40)}, ${Math.max(y(shown.v) - 14, 12)})`}>
            <rect x={-40} y={-12} width={80} height={18} rx={4} />
            <text textAnchor="middle" y={1}>{formatPrice(shown.v)} · {shortDate(shown.t)}</text>
          </g>
        )}
      </svg>
    </figure>
  );
}
