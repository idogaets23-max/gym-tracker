import { useEffect, useRef, useState } from 'preact/hooks';
import { db } from '../lib/db';
import { completedSets, fmtClock, titleForTime, workoutVolume } from '../lib/calc';
import { discardLive, finishLive, getLive, startEmpty, startFromRoutine, updateWorkout } from '../lib/actions';
import { currentPrep } from '../lib/sync';
import type { Workout } from '../lib/types';
import { nav, useExerciseMap, useLive, useNow, useSettings, useUnits } from '../hooks';
import { WorkoutEditor, NumInput } from '../components/WorkoutEditor';
import { Confirm, Sheet, TopBar } from '../components/ui';

export function PrepCard() {
  const now = useNow(60_000);
  const preps = useLive(() => db.prep.toArray(), []) ?? [];
  const [open, setOpen] = useState(false);
  const p = currentPrep(preps, now);
  if (!p) return null;
  const m = p.name.match(/-(\d{2})(\d{2})/);
  const lines = p.text.trim().split('\n');
  return (
    <div class="card" style="border-inline-start:4px solid var(--purple);margin-bottom:12px" onClick={() => setOpen(!open)}>
      <div class="row between">
        <b>📋 התוכנית להיום</b>
        {m && <span class="chip purple ltr">{m[1]}:{m[2]}</span>}
      </div>
      <div class="summary-text" style="margin-top:6px">{open ? p.text : lines.slice(0, 4).join('\n')}</div>
      {lines.length > 4 && <button class="link small">{open ? 'פחות' : 'עוד…'}</button>}
    </div>
  );
}

export function WorkoutHome() {
  const live = useLive(getLive, []);
  const routines = useLive(() => db.routines.orderBy('order').toArray(), []) ?? [];
  const lib = useExerciseMap();
  return (
    <div class="page">
      <TopBar title="אימון" />
      <PrepCard />
      {live ? (
        <button class="btn primary block" onClick={() => nav('live')}>המשך את האימון הפעיל</button>
      ) : (
        <div class="stack">
          <button class="btn primary block" onClick={async () => { await startEmpty(); nav('live'); }}>+ התחל אימון ריק</button>
          <button class="btn purple block" onClick={() => nav('bjj/new')}>🥋 רשום אימון ג'יו־ג'יטסו</button>
        </div>
      )}
      <h2>רוטינות</h2>
      {!routines.length && <p class="muted small">אין עדיין רוטינות. <button class="link" onClick={() => nav('routines/new')}>צור רוטינה</button></p>}
      {routines.slice(0, 6).map((r) => (
        <div class="card row">
          <div class="grow" onClick={() => nav('routines/' + r.id)} style="cursor:pointer">
            <b>{r.title}</b>
            <div class="muted small ltr" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:start">
              {r.exercises.map((e) => lib?.get(e.exerciseId)?.name).filter(Boolean).join(', ')}
            </div>
          </div>
          {!live && <button class="btn primary small" onClick={async () => { await startFromRoutine(r); nav('live'); }}>התחל</button>}
        </div>
      ))}
    </div>
  );
}

/** Keeps the screen on while mounted (Screen Wake Lock API). */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: any = null;
    let alive = true;
    const get = async () => {
      try { lock = await (navigator as any).wakeLock.request('screen'); } catch { /* not allowed */ }
      if (!alive) lock?.release();
    };
    const vis = () => { if (document.visibilityState === 'visible') void get(); };
    void get();
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; document.removeEventListener('visibilitychange', vis); lock?.release(); };
  }, [on]);
}

export function LivePage() {
  const live = useLive(getLive, []);
  const lib = useExerciseMap();
  const settings = useSettings();
  const units = useUnits();
  const history = useLive(() => db.workouts.filter((w) => !w.live).toArray(), []) ?? [];
  const now = useNow(1000);
  const [finish, setFinish] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [timeEdit, setTimeEdit] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const bannerT = useRef<any>();
  useWakeLock(!!live);

  if (live === undefined || !lib) return <div class="page" />;
  if (!live) {
    return (
      <div class="page">
        <TopBar title="אין אימון פעיל" backTo />
        <button class="btn primary block" onClick={async () => { await startEmpty(); }}>+ התחל אימון ריק</button>
      </div>
    );
  }
  const elapsed = ((live.manualEnd && live.end ? live.end : now) - live.start) / 1000;
  const showBanner = (t: string) => {
    setBanner(t);
    clearTimeout(bannerT.current);
    bannerT.current = setTimeout(() => setBanner(null), 3000);
  };

  return (
    <div class="page">
      {banner && <div class="banner">{banner}</div>}
      <TopBar title="אימון פעיל" backTo right={<button class="btn green small" onClick={() => setFinish(true)}>סיום</button>} />
      <div class="stats card">
        <div onClick={() => setTimeEdit(true)} style="cursor:pointer"><b class="ltr">{fmtClock(elapsed)}</b><span>משך ✎</span></div>
        <div><b class="ltr">{units.show(workoutVolume(live))} {units.label}</b><span>נפח</span></div>
        <div><b>{completedSets(live)}</b><span>סטים</span></div>
      </div>
      {!live.exercises.length && <p class="empty">התחל בהוספת תרגיל.</p>}
      <WorkoutEditor workout={live} mode="live" lib={lib} settings={settings} history={history}
        onBanner={showBanner}
        onChange={(fn) => void updateWorkout(live.id, fn)} />
      <button class="btn danger block" style="margin-top:20px" onClick={() => setDiscard(true)}>בטל אימון</button>

      {discard && (
        <Confirm title="לבטל את האימון?" text="שום דבר מהאימון הזה לא יישמר." yes="בטל אימון" no="המשך לרשום" danger
          onNo={() => setDiscard(false)}
          onYes={async () => { await discardLive(live.id); setDiscard(false); nav('', true); }} />
      )}
      {finish && <FinishSheet w={live} onClose={() => setFinish(false)} />}
      {timeEdit && <TimeSheet w={live} onClose={() => setTimeEdit(false)} />}
    </div>
  );
}

function FinishSheet(props: { w: Workout; onClose: () => void }) {
  const [title, setTitle] = useState(props.w.title);
  const [err, setErr] = useState('');
  return (
    <Sheet title="סיום אימון" onClose={props.onClose}>
      <label class="field"><span>שם האימון</span>
        <input type="text" dir="auto" value={title} placeholder={titleForTime(props.w.start)}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
      </label>
      {err && <p class="error">{err}</p>}
      <button class="btn green block" style="margin-top:14px" onClick={async () => {
        const ok = await finishLive(props.w.id, title);
        if (!ok) { setErr('אין אף סט שסומן כגמור. סמן ✓ לפחות בסט אחד, או בטל את האימון.'); return; }
        props.onClose();
        nav('w/' + props.w.id, true);
      }}>שמור אימון</button>
    </Sheet>
  );
}

const toLocal = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export function TimeSheet(props: { w: Workout; onClose: () => void; onSave?: (start: number, end?: number) => void }) {
  const [start, setStart] = useState(toLocal(props.w.start));
  const cur = props.w.end && (props.w.manualEnd || !props.w.live) ? Math.round((props.w.end - props.w.start) / 60000) : undefined;
  const [mins, setMins] = useState<number | undefined>(cur);
  return (
    <Sheet title="זמן האימון" onClose={props.onClose}>
      <label class="field"><span>התחלה</span>
        <input type="datetime-local" value={start} onInput={(e) => setStart((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field"><span>משך בדקות {props.w.live ? '(ריק = רץ עד הסיום)' : ''}</span>
        <NumInput value={mins} onChange={setMins} />
      </label>
      <button class="btn primary block" style="margin-top:14px" onClick={async () => {
        const s = new Date(start).getTime();
        if (isNaN(s)) return;
        const end = mins ? s + mins * 60000 : undefined;
        if (props.onSave) props.onSave(s, end);
        else
          await updateWorkout(props.w.id, (x) => {
            x.start = s;
            x.end = end;
            x.manualEnd = !!end;
          });
        props.onClose();
      }}>שמור</button>
    </Sheet>
  );
}
