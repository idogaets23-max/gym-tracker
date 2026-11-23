import { useState } from 'preact/hooks';
import { db, uid } from '../lib/db';
import { bestFor, epley, isWorkSet, recordsIn, RECORD_LABEL } from '../lib/calc';
import { EQUIPMENT, EXERCISE_TYPE, MUSCLE, SET_TYPE } from '../lib/labels';
import { displayName } from '../lib/seed';
import type { Equipment, ExerciseType, Muscle, Workout } from '../lib/types';
import { nav, useLive, useUnits } from '../hooks';
import { ExerciseList } from '../components/ExercisePicker';
import { LineChart } from '../components/charts';
import { Empty, Seg, TopBar } from '../components/ui';
import { fmtSetLine } from './History';

export function ExercisesPage() {
  return (
    <div class="page">
      <TopBar title="תרגילים" right={<button class="btn small" onClick={() => nav('exercises/new')}>+ תרגיל משלי</button>} />
      <ExerciseList onPick={(e) => nav('exercises/' + e.id)} />
    </div>
  );
}

type Range = '12w' | 'year' | 'all';
const RANGE: Record<Range, number> = { '12w': 84 * 86400_000, year: 365 * 86400_000, all: Infinity };

export function ExercisePage(props: { id: string }) {
  const ex = useLive(() => db.exercises.get(props.id), [props.id]);
  const workouts = useLive(() => db.workouts.filter((w) => !w.live).toArray(), []) ?? [];
  const units = useUnits();
  const [tab, setTab] = useState<'stats' | 'history' | 'howto'>('stats');
  const [range, setRange] = useState<Range>('12w');
  const [note, setNote] = useState<string | null>(null);
  if (ex === undefined) return <div class="page" />;
  if (!ex) return <div class="page"><TopBar title="התרגיל לא נמצא" backTo="exercises" /><Empty icon="🔎" text="בחר תרגיל מהרשימה." /></div>;

  const withEx = workouts.filter((w) => w.exercises.some((e) => e.exerciseId === ex.id)).sort((a, b) => a.start - b.start);
  const inRange = withEx.filter((w) => Date.now() - w.start <= RANGE[range]);
  const per = (w: Workout) => bestFor(ex.id, [w]);
  const pts = (k: 'weight' | 'e1rm' | 'volume') =>
    inRange.map((w) => ({ x: w.start, y: units.show(per(w)[k]) ?? 0, onOpen: () => nav('w/' + w.id) })).filter((p) => p.y > 0);
  const best = bestFor(ex.id, workouts);

  return (
    <div class="page">
      <TopBar title="" backTo="exercises" />
      <div class="ex-name" style="font-size:20px">{ex.name}</div>
      <div class="small muted">
        {EQUIPMENT[ex.equipment]} · ראשי: {MUSCLE[ex.primary]}
        {ex.secondary.length > 0 && <> · משני: {ex.secondary.map((m) => MUSCLE[m]).join(', ')}</>}
      </div>
      <div style="margin:12px 0">
        <Seg value={tab} options={[['stats', 'סטטיסטיקה'], ['history', 'היסטוריה'], ['howto', 'איך עושים']]} onChange={setTab} />
      </div>

      {tab === 'stats' && (
        <div class="stack">
          <select value={range} onChange={(e) => setRange((e.target as HTMLSelectElement).value as Range)}>
            <option value="12w">12 שבועות אחרונים</option>
            <option value="year">שנה אחרונה</option>
            <option value="all">מאז ומעולם</option>
          </select>
          {!withEx.length ? <Empty icon="📈" text="עוד לא רשמת את התרגיל הזה." /> : (
            <>
              <LineChart title="משקל הכי כבד" unit={units.label} points={pts('weight')} />
              <LineChart title="1RM משוער (Epley)" unit={units.label} points={pts('e1rm')} />
              <LineChart title="נפח סט הכי טוב" unit={units.label} points={pts('volume')} />
              <div class="card small">
                <b>שיאים אישיים</b>
                <div>משקל: <span class="ltr">{units.show(best.weight)} {units.label}</span></div>
                <div>1RM משוער: <span class="ltr">{units.show(Math.round(best.e1rm * 10) / 10)} {units.label}</span></div>
                <div>נפח סט: <span class="ltr">{units.show(best.volume)} {units.label}</span></div>
                <div>חזרות: {best.reps}</div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {!withEx.length && <Empty icon="📒" text="אין היסטוריה לתרגיל." />}
          {[...withEx].reverse().map((w) => {
            const recs = recordsIn(w, workouts);
            const ei = w.exercises.findIndex((e) => e.exerciseId === ex.id);
            const e = w.exercises[ei];
            let n = 0;
            return (
              <div class="card tap" onClick={() => nav('w/' + w.id)}>
                <b>{w.title}</b>
                <div class="muted small">{new Date(w.start).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                <table class="sets">
                  <tbody>
                    {e.sets.map((s, si) => {
                      if (s.type === 'normal') n++;
                      const r = recs.get(`${ei}:${si}`);
                      return (
                        <tr>
                          <td style={`width:34px;color:${SET_TYPE[s.type].color};font-weight:700`}>{s.type === 'normal' ? n : SET_TYPE[s.type].letter}</td>
                          <td class="ltr">{fmtSetLine(s, units)}{isWorkSet(s) && s.kg && s.reps ? <span class="muted small"> (1RM≈{units.show(Math.round(epley(s.kg, s.reps)))})</span> : null}</td>
                          <td>{r?.map((k) => <span class="chip gold">🏆 {RECORD_LABEL[k]}</span>)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'howto' && (
        <div>
          <div class="card">
            <b>📌 הערה נעוצה</b>
            <p class="muted small">מופיעה בכל פעם שתרשום את התרגיל.</p>
            <textarea rows={3} dir="auto" value={note ?? ex.note ?? ''} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
            {note != null && note !== (ex.note ?? '') && (
              <button class="btn primary small" style="margin-top:8px" onClick={async () => { await db.exercises.update(ex.id, { note: note.trim() || undefined }); setNote(null); }}>שמור הערה</button>
            )}
          </div>
          {ex.howto?.length ? (
            <ol class="card" style="padding-inline-start:30px">
              {ex.howto.map((s) => <li style="margin:6px 0">{s}</li>)}
            </ol>
          ) : (
            <p class="muted small" style="margin-top:12px">אין הוראות לתרגיל הזה. אפשר לכתוב לעצמך דגשים בהערה הנעוצה.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomExerciseForm() {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType | ''>('');
  const [equipment, setEquipment] = useState<Equipment | ''>('');
  const [primary, setPrimary] = useState<Muscle | ''>('');
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const ok = name.trim() && type && equipment && primary;
  return (
    <div class="page">
      <TopBar title="תרגיל חדש" backTo="exercises" />
      <label class="field"><span>שם (באנגלית, כדי שיופיע בחיפוש עם השאר)</span>
        <input type="text" dir="ltr" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field"><span>סוג</span>
        <select value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value as ExerciseType)}>
          <option value="">בחר…</option>
          {(Object.keys(EXERCISE_TYPE) as ExerciseType[]).map((k) => <option value={k}>{EXERCISE_TYPE[k]}</option>)}
        </select>
      </label>
      <label class="field"><span>ציוד</span>
        <select value={equipment} onChange={(e) => setEquipment((e.target as HTMLSelectElement).value as Equipment)}>
          <option value="">בחר…</option>
          {(Object.keys(EQUIPMENT) as Equipment[]).map((k) => <option value={k}>{EQUIPMENT[k]}</option>)}
        </select>
      </label>
      <label class="field"><span>שריר ראשי</span>
        <select value={primary} onChange={(e) => setPrimary((e.target as HTMLSelectElement).value as Muscle)}>
          <option value="">בחר…</option>
          {(Object.keys(MUSCLE) as Muscle[]).map((k) => <option value={k}>{MUSCLE[k]}</option>)}
        </select>
      </label>
      <div class="field"><span class="muted small">שרירים נוספים</span>
        <div class="row wrap" style="margin-top:6px">
          {(Object.keys(MUSCLE) as Muscle[]).filter((m) => m !== primary).map((m) => (
            <button class={'chip' + (secondary.includes(m) ? ' blue' : '')} style="border:0;padding:6px 10px;font-size:14px"
              onClick={() => setSecondary(secondary.includes(m) ? secondary.filter((x) => x !== m) : [...secondary, m])}>{MUSCLE[m]}</button>
          ))}
        </div>
      </div>
      <button class="btn primary block" style="margin-top:16px" disabled={!ok} onClick={async () => {
        const id = 'c-' + uid();
        await db.exercises.add({
          id, name: displayName(name.trim(), equipment as Equipment), type: type as ExerciseType,
          equipment: equipment as Equipment, primary: primary as Muscle, secondary: secondary.filter((m) => m !== primary), custom: true,
        });
        history.back();
      }}>צור תרגיל</button>
    </div>
  );
}
