import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n.js';

/** Lightweight interactive SVG area chart (no external chart lib). */
export function AreaChart({ series, height = 220 }: { series: { label: string; bytes: number }[]; height?: number }) {
  const { bytes, locale } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, PAD_X = 8, PAD_TOP = 14, PAD_BOT = 26;

  const { path, area, pts, max } = useMemo(() => {
    const maxV = Math.max(1, ...series.map((s) => s.bytes)) * 1.15;
    const n = Math.max(1, series.length - 1);
    const ptsArr = series.map((s, i) => ({
      x: PAD_X + (i / n) * (W - PAD_X * 2),
      y: PAD_TOP + (1 - s.bytes / maxV) * (H - PAD_TOP - PAD_BOT),
    }));
    const d = ptsArr.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `${d} L${ptsArr[ptsArr.length - 1]?.x ?? 0},${H - PAD_BOT} L${ptsArr[0]?.x ?? 0},${H - PAD_BOT} Z`;
    return { path: d, area: areaD, pts: ptsArr, max: maxV };
  }, [series, H]);

  const fmt = (n: number) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { notation: 'compact' }).format(n);

  return (
    <div className="chart-box" style={{ position: 'relative' }} dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="traffic chart">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c6cff" stopOpacity=".34" />
            <stop offset="100%" stopColor="#7c6cff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c6cff" />
            <stop offset="100%" stopColor="#3ec6ff" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + (1 - f) * (H - PAD_TOP - PAD_BOT)} y2={PAD_TOP + (1 - f) * (H - PAD_TOP - PAD_BOT)} stroke="#16223c" strokeWidth="1" />
            <text x={W - PAD_X} y={PAD_TOP + (1 - f) * (H - PAD_TOP - PAD_BOT) - 4} fill="#5c6c8c" fontSize="9.5" textAnchor="end">{fmt(max * f)}</text>
          </g>
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={path} fill="none" stroke="url(#lineStroke)" strokeWidth="2.2" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3.2} fill="#0c1220" stroke={hover === i ? '#3ec6ff' : '#7c6cff'} strokeWidth="2" />
            <text x={p.x} y={H - 8} fill="#5c6c8c" fontSize="9.5" textAnchor="middle">{series[i].label.slice(5)}</text>
            <rect x={p.x - (W / pts.length) / 2} y={0} width={W / pts.length} height={H} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>
      {hover !== null && series[hover] && (
        <div className="chart-tooltip" style={{ left: `${(pts[hover].x / W) * 100}%`, top: `${(pts[hover].y / H) * 100}%` }}>
          {series[hover].label} · {bytes(series[hover].bytes)}
        </div>
      )}
    </div>
  );
}

/** Donut chart with legend. */
export function Donut({ data, centerLabel, centerValue }: { data: { label: string; value: number; color: string }[]; centerLabel: string; centerValue: string }) {
  const total = Math.max(1, data.reduce((a, b) => a + b.value, 0));
  const R = 54, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', justifyContent: 'center', padding: '8px 4px' }}>
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={centerLabel}>
        <circle cx="75" cy="75" r={R} fill="none" stroke="#141f36" strokeWidth="15" />
        {data.map((d) => {
          const frac = d.value / total;
          const dash = `${frac * C} ${C}`;
          const offset = -acc * C;
          acc += frac;
          return <circle key={d.label} cx="75" cy="75" r={R} fill="none" stroke={d.color} strokeWidth="15" strokeDasharray={dash} strokeDashoffset={offset} transform="rotate(-90 75 75)" strokeLinecap="butt" />;
        })}
        <text x="75" y="72" textAnchor="middle" fill="#edf1fb" fontSize="17" fontWeight="800">{centerValue}</text>
        <text x="75" y="90" textAnchor="middle" fill="#64748f" fontSize="9.5">{centerLabel}</text>
      </svg>
      <div className="legend">
        {data.map((d) => (
          <div className="legend-row" key={d.label}>
            <span className="legend-dot" style={{ background: d.color }} />
            {d.label}
            <b>{new Intl.NumberFormat().format(d.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
