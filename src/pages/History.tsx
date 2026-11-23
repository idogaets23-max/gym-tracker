import { useState } from 'preact/hooks';
import { db } from '../lib/db';
import { fmtDuration, recordCount, recordsIn, workoutVolume, RECORD_LABEL } from '../lib/calc';
import { deleteBjj, deleteWorkout, repeatWorkout, saveEditedWorkout } from '../lib/actions';
import { BJJ_TYPE, SET_TYPE } from '../lib/labels';
import type { BjjSession, Exercise, Workout } from '../lib/types';
import { nav, useExerciseMap, useLive, useSettings, useUnits } from '../hooks';
import { CoachSection, SyncChip, useConnected } from '../components/Coach';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Confirm, Empty, Menu, TopBar } from '../components/ui';
import { TimeSheet } from './Workout';

const dateStr = (ms: number) =>
  new Date(ms).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
  ' · ' + new Date(ms).toTimeString().slice(0, 5);

type Entry = { kind: 'w'; w: Workout } | { kind: 'b'; b: BjjSession };

export function HistoryPage() {
  const workouts = useLive(() => db.workouts.filter((w) => !w.live).toArray(), []);
  const bjj = useLive(() => db.bjj.toArray(), []);
  const sync = useLive(async () => new Map((await db.sync.toArray()).map((s) => [s.entryId, s])), []);
  const lib = useExerciseMap();
  const connected = useConnected();
  const units = useUnits();
  if (!workouts || !bjj || !lib) return <div class="page" />;
  const entries: Entry[] = [
    ...workouts.map((w) => ({ kind: 'w' as const, w })),
    ...bjj.map((b) => ({ kind: 'b' as const, b })),
  ].sort((a, b) => (b.kind === 'w' ? b.w.start : b.b.start) - (a.kind === 'w' ? a.w.start : a.b.start));

  return (
    <div class="page">
      <TopBar title="היסטוריה" />
      {!entries.length && (
        <Empty icon="📒" text="עוד אין אימונים. אימון שתשמור יופיע כאן.">
          <button class="btn primary" onClick={() => nav('')}>לאימון</button>
        </Empty>
      )}
      {entries.map((e) =>
        e.kind === 'w' ? (
          <WorkoutCard w={e.w} all={workouts} lib={lib} sync={sync?.get(e.w.id)} connected={connected} units={units} />
        ) : (
          <div class="card bjj tap" onClick={() => nav('b/' + e.b.id)}>
            <div class="row between">
              <b>🥋 ג'יו־ג'יטסו · {BJJ_TYPE[e.b.type]}</b>
              <SyncChip s={sync?.get(e.b.id)} connected={connected} />
            </div>
            <div class="muted small">{dateStr(e.b.start)}</div>
            <div class="stats">
              <div><b>{e.b.minutes} ד'</b><span>משך</span></div>
              <div><b>{e.b.intensity}/10</b><span>קושי</span></div>
            </div>
            <div class="summary-text small" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{e.b.summary}</div>
          </div>
        ),
      )}
    </div>
  );
}

function WorkoutCard(props: { w: Workout; all: Workout[]; lib: Map<string, Exercise>; sync: any; connected: boolean; units: ReturnType<typeof useUnits> }) {
  const { w, lib, units } = props;
  const recs = recordCount(w, props.all);
  return (
    <div class="card gym tap" onClick={() => nav('w/' + w.id)}>
      <div class="row between">
        <b>{w.title}</b>
        <SyncChip s={props.sync} connected={props.connected} />
      </div>
      <div class="muted small">{dateStr(w.start)}</div>
      <div class="stats">
        <div><b>{fmtDuration(((w.end ?? w.start) - w.start) / 1000)}</b><span>משך</span></div>
        <div><b class="ltr">{units.show(workoutVolume(w))} {units.label}</b><span>נפח</span></div>
        {recs > 0 && <div><b>🏆 {recs}</b><span>שיאים</span></div>}
      </div>
      {w.exercises.slice(0, 3).map((e) => (
        <div class="small ltr" style="text-align:start">{e.sets.length} sets {lib.get(e.exerciseId)?.name}</div>
      ))}
      {w.exercises.length > 3 && <div class="muted small">ועוד {w.exercises.length - 3} תרגילים</div>}
    </div>
  );
}

export function WorkoutDetail(props: { id: string }) {
  const w = useLive(() => db.workouts.get(props.id), [props.id]);
  const all = useLive(() => db.workouts.filter((x) => !x.live).toArray(), []) ?? [];
  const lib = useExerciseMap();
  const units = useUnits();
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  if (w === undefined || !lib) return <div class="page" />;
  if (!w) return <div class="page"><TopBar title="האימון לא נמצא" backTo="history" /></div>;
  const recs = recordsIn(w, all);
  return (
    <div class="page">
      <TopBar title={w.title} backTo="history" right={<button class="icon-btn" aria-label="תפריט" onClick={() => setMenu(true)}>⋯</button>} />
      <div class="muted small">{dateStr(w.start)}</div>
      <div class="stats card" style="margin-top:8px">
        <div><b>{fmtDuration(((w.end ?? w.start) - w.start) / 1000)}</b><span>משך</span></div>
        <div><b class="ltr">{units.show(workoutVolume(w))} {units.label}</b><span>נפח</span></div>
        <div><b>🏆 {[...recs.values()].reduce((a, k) => a + k.length, 0)}</b><span>שיאים</span></div>
      </div>
      {w.exercises.map((e, ei) => {
        let n = 0;
        return (
          <div class="block">
            <div class="ex-name" style="color:var(--blue);cursor:pointer" onClick={() => nav('exercises/' + e.exerciseId)}>{lib.get(e.exerciseId)?.name}</div>
            {e.note && <div class="note">📌 {e.note}</div>}
            <table class="sets">
              <thead><tr><th>סט</th><th>משקל וחזרות</th><th /></tr></thead>
              <tbody>
                {e.sets.map((s, si) => {
                  if (s.type === 'normal') n++;
                  const r = recs.get(`${ei}:${si}`);
                  return (
                    <tr>
                      <td style={`color:${SET_TYPE[s.type].color};font-weight:700`}>{s.type === 'normal' ? n : SET_TYPE[s.type].letter}</td>
                      <td class="ltr">{fmtSetLine(s, units)}</td>
                      <td>{r && r.map((k) => <span class="chip gold" title={RECORD_LABEL[k]}>🏆 {RECORD_LABEL[k]}</span>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      <CoachSection entryId={w.id} />
      {menu && (
        <Menu onClose={() => setMenu(false)} items={[
          { label: 'ערוך אימון', icon: '✎', onClick: () => nav(`w/${w.id}/edit`) },
          { label: 'חזור על האימון', icon: '↻', onClick: async () => { await repeatWorkout(w); nav('live'); } },
          { label: 'מחק אימון', icon: '🗑', danger: true, onClick: () => setDel(true) },
        ]} />
      )}
      {del && (
        <Confirm title="למחוק את האימון?" text="אי אפשר לשחזר. השיאים יחושבו מחדש." yes="מחק" no="ביטול" danger
          onNo={() => setDel(false)} onYes={async () => { await deleteWorkout(w.id); nav('history', true); }} />
      )}
    </div>
  );
}

export function fmtSetLine(s: { kg?: number; reps?: number; secs?: number; km?: number; rpe?: number }, units: ReturnType<typeof useUnits>) {
  const p: string[] = [];
  if (s.kg != null) p.push(`${units.show(s.kg)} ${units.label === 'lb' ? 'lb' : 'kg'}`);
  if (s.reps != null) p.push(`× ${s.reps}`);
  if (s.secs != null) p.push(`${s.secs} s`);
  if (s.km != null) p.push(`${s.km} km`);
  let t = p.join(' ');
  if (s.rpe) t += ` @${s.rpe}`;
  return t || '-';
}

export function EditWorkout(props: { id: string }) {
  const orig = useLive(() => db.workouts.get(props.id), [props.id]);
  const all = useLive(() => db.workouts.filter((x) => !x.live && x.id !== props.id).toArray(), [props.id]) ?? [];
  const lib = useExerciseMap();
  const settings = useSettings();
  const [draft, setDraft] = useState<Workout | null>(null);
  const [time, setTime] = useState(false);
  if (!orig || !lib) return <div class="page" />;
  const w = draft ?? structuredClone({ ...orig, exercises: orig.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) })) });
  const change = (fn: (x: Workout) => void) => {
    const c = structuredClone(w);
    fn(c);
    setDraft(c);
  };
  return (
    <div class="page">
      <TopBar title="עריכת אימון" backTo right={
        <button class="btn primary small" onClick={async () => { await saveEditedWorkout(w); nav('w/' + w.id, true); }}>שמור</button>
      } />
      <label class="field"><span>שם</span>
        <input type="text" dir="auto" value={w.title} onInput={(e) => change((x) => { x.title = (e.target as HTMLInputElement).value; })} />
      </label>
      <button class="link" onClick={() => setTime(true)}>⏱ {dateStr(w.start)} · {fmtDuration(((w.end ?? w.start) - w.start) / 1000)}</button>
      <p class="muted small">סט שתבטל לו את ה־✓ יימחק בשמירה.</p>
      <WorkoutEditor workout={w} mode="edit" lib={lib} settings={settings} history={all} onChange={change} />
      {time && <TimeSheet w={w} onClose={() => setTime(false)} onSave={(s, end) => change((x) => { x.start = s; x.end = end ?? x.end; })} />}
    </div>
  );
}

export function BjjDetail(props: { id: string }) {
  const b = useLive(() => db.bjj.get(props.id), [props.id]);
  const [del, setDel] = useState(false);
  if (b === undefined) return <div class="page" />;
  if (!b) return <div class="page"><TopBar title="האימון לא נמצא" backTo="history" /></div>;
  return (
    <div class="page">
      <TopBar title={`ג'יו־ג'יטסו · ${BJJ_TYPE[b.type]}`} backTo="history"
        right={<button class="btn small" onClick={() => nav(`bjj/${b.id}/edit`)}>ערוך</button>} />
      <div class="muted small">{dateStr(b.start)}</div>
      <div class="stats card" style="margin-top:8px">
        <div><b>{b.minutes} ד'</b><span>משך</span></div>
        <div><b>{b.intensity}/10</b><span>קושי</span></div>
      </div>
      <div class="card summary-text" style="margin-top:10px">{b.summary}</div>
      <CoachSection entryId={b.id} />
      <button class="btn danger block" style="margin-top:16px" onClick={() => setDel(true)}>מחק</button>
      {del && (
        <Confirm title="למחוק את האימון?" text="אי אפשר לשחזר." yes="מחק" no="ביטול" danger
          onNo={() => setDel(false)} onYes={async () => { await deleteBjj(b.id); nav('history', true); }} />
      )}
    </div>
  );
}
