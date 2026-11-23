import { useState } from 'preact/hooks';
import type { Muscle } from '../lib/types';
import { MUSCLE } from '../lib/labels';

const dfmt = (ms: number) => new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

export interface Pt { x: number; y: number; onOpen?: () => void }

export function LineChart(props: { points: Pt[]; unit: string; title: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const pts = [...props.points].sort((a, b) => a.x - b.x);
  const W = 320, H = 140, P = 10;
  if (!pts.length) return <div class="card"><b>{props.title}</b><p class="muted small">אין נתונים בטווח.</p></div>;
  const best = Math.max(...pts.map((p) => p.y));
  const minY = Math.min(...pts.map((p) => p.y));
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const sx = (x: number) => (x1 === x0 ? W / 2 : P + ((x - x0) / (x1 - x0)) * (W - 2 * P));
  const sy = (y: number) => (best === minY ? H / 2 : H - P - ((y - minY) / (best - minY)) * (H - 2 * P));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const s = sel != null ? pts[sel] : null;
  return (
    <div class="card">
      <div class="muted small">{props.title}</div>
      <div class="headline ltr" style="text-align:start">{Math.round(best * 10) / 10} {props.unit}</div>
      <svg class="chart ltr" viewBox={`0 0 ${W} ${H + 16}`}>
        <path d={d} fill="none" stroke="var(--blue)" stroke-width="2" />
        {pts.map((p, i) => (
          <circle cx={sx(p.x)} cy={sy(p.y)} r={sel === i ? 6 : 4} fill={sel === i ? 'var(--orange)' : 'var(--blue)'}
            onClick={() => setSel(i)} style="cursor:pointer" />
        ))}
        <text x={P} y={H + 14}>{dfmt(x0)}</text>
        <text x={W - P} y={H + 14} text-anchor="end">{dfmt(x1)}</text>
      </svg>
      {s && (
        <div class="row between small">
          <span>{dfmt(s.x)}: <b class="ltr">{Math.round(s.y * 10) / 10} {props.unit}</b></span>
          {s.onOpen && <button class="link" onClick={s.onOpen}>פתח אימון</button>}
        </div>
      )}
    </div>
  );
}

/** Stacked bars: each bar has values per series. */
export function BarChart(props: { bars: { label: string; values: number[] }[]; colors: string[]; fmt: (n: number) => string }) {
  const W = 320, H = 130;
  const max = Math.max(1, ...props.bars.map((b) => b.values.reduce((a, c) => a + c, 0)));
  const bw = W / Math.max(1, props.bars.length);
  return (
    <svg class="chart ltr" viewBox={`0 0 ${W} ${H + 16}`}>
      {props.bars.map((b, i) => {
        let y = H;
        return (
          <g>
            {b.values.map((v, k) => {
              const h = (v / max) * (H - 14);
              y -= h;
              return <rect x={i * bw + bw * 0.15} y={y} width={bw * 0.7} height={h} rx="2" fill={props.colors[k]} />;
            })}
            {(i === 0 || i === props.bars.length - 1 || props.bars.length <= 8) && (
              <text x={i * bw + bw / 2} y={H + 13} text-anchor="middle">{b.label}</text>
            )}
          </g>
        );
      })}
      <text x={W} y="10" text-anchor="end">{props.fmt(max)}</text>
    </svg>
  );
}

// Simple front and back body outline with muscle regions as shapes.
type Shape = [number, number, number, number]; // cx, cy, rx, ry
const FRONT: Partial<Record<Muscle, Shape[]>> = {
  neck: [[50, 22, 5, 4]],
  traps: [[42, 27, 6, 3], [58, 27, 6, 3]],
  shoulders: [[33, 33, 6, 6], [67, 33, 6, 6]],
  chest: [[43, 40, 8, 6], [57, 40, 8, 6]],
  biceps: [[29, 48, 4, 8], [71, 48, 4, 8]],
  forearms: [[26, 65, 3.5, 9], [74, 65, 3.5, 9]],
  abdominals: [[50, 56, 7, 11]],
  abductors: [[38, 76, 3, 6], [62, 76, 3, 6]],
  adductors: [[46, 84, 3, 8], [54, 84, 3, 8]],
  quadriceps: [[41, 92, 6, 13], [59, 92, 6, 13]],
  calves: [[41, 122, 4, 10], [59, 122, 4, 10]],
};
const BACK: Partial<Record<Muscle, Shape[]>> = {
  traps: [[50, 30, 12, 6]],
  shoulders: [[33, 33, 6, 6], [67, 33, 6, 6]],
  upper_back: [[50, 40, 10, 5]],
  lats: [[41, 49, 7, 9], [59, 49, 7, 9]],
  triceps: [[29, 48, 4, 8], [71, 48, 4, 8]],
  forearms: [[26, 65, 3.5, 9], [74, 65, 3.5, 9]],
  lower_back: [[50, 62, 6, 6]],
  glutes: [[44, 76, 7, 7], [56, 76, 7, 7]],
  hamstrings: [[42, 95, 5.5, 12], [58, 95, 5.5, 12]],
  calves: [[41, 122, 4.5, 10], [59, 122, 4.5, 10]],
};

function Figure(props: { map: Partial<Record<Muscle, Shape[]>>; values: Map<Muscle, number>; max: number; label: string }) {
  return (
    <svg viewBox="0 0 100 140" style="width:46%" aria-label={props.label}>
      <circle cx="50" cy="11" r="8" fill="var(--card2)" />
      <path d="M30 26 Q50 20 70 26 L76 70 L72 72 L66 44 L64 72 L66 135 L54 135 L50 84 L46 135 L34 135 L36 72 L34 44 L28 72 L24 70 Z" fill="var(--card2)" />
      {(Object.keys(props.map) as Muscle[]).map((m) =>
        props.map[m]!.map(([cx, cy, rx, ry]) => {
          const v = props.values.get(m) ?? 0;
          const op = v ? 0.25 + 0.75 * (v / props.max) : 0;
          return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--blue)" fill-opacity={op} stroke="var(--line)" stroke-width="0.4" />;
        }),
      )}
      <text x="50" y="139" text-anchor="middle" style="font-size:6px;fill:var(--muted)">{props.label}</text>
    </svg>
  );
}

export function MuscleSummary(props: { data: [Muscle, number][] }) {
  const values = new Map(props.data);
  const max = Math.max(1, ...props.data.map((d) => d[1]));
  return (
    <div>
      <div class="row" style="justify-content:space-around">
        <Figure map={FRONT} values={values} max={max} label="מלפנים" />
        <Figure map={BACK} values={values} max={max} label="מאחור" />
      </div>
      <div class="bars">
        <div class="row between small muted"><span>שריר</span><span>סטים</span></div>
        {props.data.map(([m, v]) => (
          <div class="bar">
            <span class="lbl">{MUSCLE[m]}</span>
            <div class="grow"><div class="fill" style={`width:${(v / max) * 100}%`} /></div>
            <b class="ltr" style="width:34px;text-align:end">{v}</b>
          </div>
        ))}
        {!props.data.length && <p class="muted small">אין עדיין סטים.</p>}
      </div>
    </div>
  );
}
