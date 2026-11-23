import { useState } from 'preact/hooks';
import { db } from '../lib/db';
import { fmtDuration, isWorkSet, muscleSets, weekStart, workoutReps, ymd } from '../lib/calc';
import { nav, useExerciseMap, useLive, useSettings, useUnits } from '../hooks';
import { BarChart, LineChart, MuscleSummary } from '../components/charts';
import { Empty, Menu, Seg, TopBar } from '../components/ui';
import { NumInput } from '../components/WorkoutEditor';

const DAY = 86400_000;

export function ProfilePage() {
  const workouts = useLive(() => db.workouts.filter((w) => !w.live).toArray(), []);
  const bjj = useLive(() => db.bjj.toArray(), []);
  const lib = useExerciseMap();
  const settings = useSettings();
  const [metric, setMetric] = useState<'duration' | 'reps'>('duration');
  const [range, setRange] = useState<12 | 52 | 0>(12);
  const [rangeMenu, setRangeMenu] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); });
  const [dayPick, setDayPick] = useState<{ label: string; go: string }[] | null>(null);
  if (!workouts || !bjj || !lib) return <div class="page" />;

  // weekly bars
  const thisWeek = weekStart(Date.now(), settings.weekStart);
  const firstAll = Math.min(thisWeek, ...workouts.map((w) => w.start), ...bjj.map((b) => b.start));
  const weeks = range ? range : Math.max(1, Math.round((thisWeek - weekStart(firstAll, settings.weekStart)) / (7 * DAY)) + 1);
  const bars = Array.from({ length: weeks }, (_, i) => {
    const ws = thisWeek - (weeks - 1 - i) * 7 * DAY;
    const we = ws + 7 * DAY;
    const ww = workouts.filter((w) => w.start >= ws && w.start < we);
    const bb = bjj.filter((b) => b.start >= ws && b.start < we);
    const gymMin = ww.reduce((a, w) => a + ((w.end ?? w.start) - w.start) / 60000, 0);
    const bjjMin = bb.reduce((a, b) => a + b.minutes, 0);
    const reps = ww.reduce((a, w) => a + workoutReps(w), 0);
    const d = new Date(ws);
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, values: metric === 'duration' ? [gymMin, bjjMin] : [reps] };
  });
  const cur = bars[bars.length - 1]?.values.reduce((a, b) => a + b, 0) ?? 0;

  // calendar
  const m0 = new Date(month);
  const gridStart = weekStart(month, settings.weekStart);
  const days = Array.from({ length: 42 }, (_, i) => gridStart + i * DAY + 3600_000 * 2);
  const byDay = new Map<string, { gym: string[]; bjj: string[] }>();
  for (const w of workouts) { const k = ymd(w.start); const v = byDay.get(k) ?? { gym: [], bjj: [] }; v.gym.push(w.id); byDay.set(k, v); }
  for (const b of bjj) { const k = ymd(b.start); const v = byDay.get(k) ?? { gym: [], bjj: [] }; v.bjj.push(b.id); byDay.set(k, v); }
  const heads = settings.weekStart === 0 ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] : ['ב', 'ג', 'ד', 'ה', 'ו', 'ש', 'א'];

  // muscles, last 7 days
  const recent = workouts.filter((w) => w.start > Date.now() - 7 * DAY);
  const items = recent.flatMap((w) => w.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter(isWorkSet).length })));
  const muscles = muscleSets(items, lib);

  return (
    <div class="page">
      <TopBar title="פרופיל" right={<button class="icon-btn" aria-label="הגדרות" onClick={() => nav('settings')}>⚙︎</button>} />
      <div class="stats card">
        <div><b>{workouts.length}</b><span>אימוני כוח</span></div>
        <div><b>{bjj.length}</b><span>אימוני ג'יו־ג'יטסו</span></div>
        <button class="link" onClick={() => nav('profile/bodyweight')}>⚖️ משקל גוף</button>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="row between">
          <b>{metric === 'duration' ? `השבוע: ${fmtDuration(cur * 60)}` : `השבוע: ${cur} חזרות`}</b>
          <button class="link small" onClick={() => setRangeMenu(true)}>{range === 12 ? '12 שבועות' : range === 52 ? 'שנה' : 'הכול'} ▾</button>
        </div>
        <BarChart bars={bars} colors={metric === 'duration' ? ['var(--blue)', 'var(--purple)'] : ['var(--blue)']}
          fmt={(n) => (metric === 'duration' ? fmtDuration(n * 60) : String(Math.round(n)))} />
        {metric === 'duration' && <div class="row small" style="gap:14px"><span><span class="dot" style="background:var(--blue)" /> כוח</span><span><span class="dot" style="background:var(--purple)" /> ג'יו־ג'יטסו</span></div>}
        <div style="margin-top:8px"><Seg value={metric} options={[['duration', 'משך'], ['reps', 'חזרות']]} onChange={setMetric} /></div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="row between">
          <button class="icon-btn" aria-label="חודש קודם" onClick={() => setMonth(new Date(m0.getFullYear(), m0.getMonth() - 1, 1).getTime())}>›</button>
          <b>{m0.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</b>
          <button class="icon-btn" aria-label="חודש הבא" onClick={() => setMonth(new Date(m0.getFullYear(), m0.getMonth() + 1, 1).getTime())}>‹</button>
        </div>
        <div class="cal">
          {heads.map((h) => <div class="h">{h}</div>)}
          {days.map((d) => {
            const dt = new Date(d);
            const v = byDay.get(ymd(d));
            const cls = [
              v?.gym.length && v?.bjj.length ? 'both' : v?.gym.length ? 'gym' : v?.bjj.length ? 'bjj' : '',
              ymd(d) === ymd(Date.now()) ? 'today' : '',
              dt.getMonth() !== m0.getMonth() ? 'other' : '',
            ].join(' ');
            return (
              <button class={cls} onClick={() => {
                if (!v) return;
                const opts = [
                  ...v.gym.map((id) => ({ label: '🏋️ ' + (workouts.find((w) => w.id === id)?.title ?? ''), go: 'w/' + id })),
                  ...v.bjj.map((id) => ({ label: "🥋 ג'יו־ג'יטסו", go: 'b/' + id })),
                ];
                if (opts.length === 1) nav(opts[0].go); else setDayPick(opts);
              }}>{dt.getDate()}</button>
            );
          })}
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <b>סטים לפי שריר, 7 ימים אחרונים</b>
        <MuscleSummary data={muscles} />
      </div>

      {rangeMenu && <Menu onClose={() => setRangeMenu(false)} items={[
        { label: '12 שבועות אחרונים', onClick: () => setRange(12) },
        { label: 'שנה', onClick: () => setRange(52) },
        { label: 'הכול', onClick: () => setRange(0) },
      ]} />}
      {dayPick && <Menu onClose={() => setDayPick(null)} items={dayPick.map((o) => ({ label: o.label, onClick: () => nav(o.go) }))} />}
    </div>
  );
}

export function BodyWeightPage() {
  const entries = useLive(() => db.bodyweight.orderBy('date').reverse().toArray(), []) ?? [];
  const units = useUnits();
  const [date, setDate] = useState(ymd(Date.now()));
  const [kg, setKg] = useState<number | undefined>();
  return (
    <div class="page">
      <TopBar title="משקל גוף" backTo="profile" />
      <div class="row">
        <input type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
        <div style="width:110px"><NumInput value={kg} placeholder={units.label} onChange={setKg} /></div>
        <button class="btn primary" disabled={!kg || !date} onClick={async () => {
          await db.bodyweight.put({ date, kg: units.toKg(kg)! });
          setKg(undefined);
        }}>שמור</button>
      </div>
      <p class="muted small">תאריך שכבר קיים יוחלף.</p>
      {entries.length ? (
        <>
          <LineChart title="משקל גוף" unit={units.label}
            points={entries.map((e) => ({ x: new Date(e.date).getTime(), y: units.show(e.kg) ?? 0 }))} />
          {entries.map((e) => (
            <div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)">
              <span>{new Date(e.date).toLocaleDateString('he-IL')}</span>
              <b class="ltr">{units.show(e.kg)} {units.label}</b>
              <button class="icon-btn" aria-label="מחק" onClick={() => db.bodyweight.delete(e.date)}>✕</button>
            </div>
          ))}
        </>
      ) : <Empty icon="⚖️" text="עוד אין שקילות. הוסף את הראשונה למעלה." />}
    </div>
  );
}
