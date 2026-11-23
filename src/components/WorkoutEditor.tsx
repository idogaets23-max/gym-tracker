import { useRef, useState } from 'preact/hooks';
import { db, uid } from '../lib/db';
import { COLUMN_LABEL, SET_TYPE, columnsFor } from '../lib/labels';
import { RECORD_LABEL, fmtRest, liveRecord, plates, previousSets, restOptions, warmupSets } from '../lib/calc';
import { placeholder } from '../lib/actions';
import type { Exercise, Settings, SetType, WExercise, WSet, Workout } from '../lib/types';
import { useUnits } from '../hooks';
import { ExercisePicker } from './ExercisePicker';
import { Menu, Sheet } from './ui';

type Col = 'kg' | 'reps' | 'secs' | 'km';

export function WorkoutEditor(props: {
  workout: Workout;
  onChange: (fn: (w: Workout) => void) => void;
  mode: 'live' | 'edit';
  history: Workout[];
  lib: Map<string, Exercise>;
  settings: Settings;
  onBanner?: (text: string) => void;
}) {
  const { workout: w, lib, settings } = props;
  const [picker, setPicker] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [typeFor, setTypeFor] = useState<[number, number] | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [restFor, setRestFor] = useState<number | null>(null);
  const [platesFor, setPlatesFor] = useState<number | null>(null);
  const units = useUnits();

  const edit = (fn: (w: Workout) => void) => props.onChange(fn);

  function addExercises(ids: string[]) {
    edit((x) => {
      for (const id of ids) {
        x.exercises.push({
          exerciseId: id,
          restSec: settings.defaultRestSec || undefined,
          note: lib.get(id)?.note,
          sets: [{ type: 'normal' }],
        });
      }
    });
  }

  function toggleDone(ei: number, si: number) {
    const cur = w.exercises[ei];
    const wasDone = !!cur.sets[si].done;
    // work out the completed set here: `edit` may run later (it writes to the database)
    const prevSet = previousSets(cur.exerciseId, props.history)[si];
    const filled: WSet = { ...cur.sets[si], done: true };
    for (const c of columnsFor(lib.get(cur.exerciseId)?.type ?? 'weight_reps')) {
      if (filled[c] == null) filled[c] = placeholder(filled, prevSet, c);
    }
    edit((x) => {
      const s = x.exercises[ei].sets[si];
      if (wasDone) s.done = false;
      else Object.assign(s, filled);
    });
    if (!wasDone && props.mode === 'live') {
      const ex: WExercise = { ...cur, sets: cur.sets.map((s, i) => (i === si ? filled : s)) };
      const set = ex.sets[si];
      const rest = ex.restSec ?? 0;
      if (rest > 0) void db.kv.put({ key: 'rest', value: { end: Date.now() + rest * 1000, total: rest } });
      if (settings.liveRecords) {
        const kinds = liveRecord(ex.exerciseId, set, props.history, ex);
        if (kinds.length) props.onBanner?.('🏆 שיא חדש: ' + kinds.map((k) => RECORD_LABEL[k]).join(', '));
      }
    }
  }

  const menuEx = menuFor != null ? w.exercises[menuFor] : null;
  const menuLib = menuEx ? lib.get(menuEx.exerciseId) : null;

  return (
    <div>
      {w.exercises.map((ex, ei) => {
        const e = lib.get(ex.exerciseId);
        const cols = columnsFor(e?.type ?? 'weight_reps');
        const prev = previousSets(ex.exerciseId, props.history, w.start);
        let normalNo = 0;
        return (
          <div class={'block' + (ex.supersetId ? ' superset' : '')}>
            <div class="row">
              <div class="grow">
                <div class="ex-name" style="color:var(--blue)">{e?.name ?? 'תרגיל שנמחק'}</div>
                <button class="link small" onClick={() => setRestFor(ei)}>⏱ מנוחה: {fmtRest(ex.restSec)}</button>
              </div>
              <button class="icon-btn" aria-label="תפריט תרגיל" onClick={() => setMenuFor(ei)}>⋮</button>
            </div>
            {ex.note && <div class="note" onClick={() => setNoteFor(ei)}>📌 {ex.note}</div>}
            <table class="sets">
              <thead>
                <tr>
                  <th>סט</th>
                  <th>קודם</th>
                  {cols.map((c) => <th>{c === 'kg' ? units.label : COLUMN_LABEL[c]}</th>)}
                  {settings.rpe && <th>RPE</th>}
                  <th>✓</th>
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((s, si) => {
                  if (s.type === 'normal') normalNo++;
                  const p = prev[si];
                  return (
                    <SwipeRow done={!!s.done} onDelete={() => edit((x) => { x.exercises[ei].sets.splice(si, 1); })}>
                      <td>
                        <button class="settype" style={`color:${SET_TYPE[s.type].color}`} onClick={() => setTypeFor([ei, si])}>
                          {s.type === 'normal' ? normalNo : SET_TYPE[s.type].letter}
                        </button>
                      </td>
                      <td class="prev">{p ? fmtPrev(p, cols, units.show) : '—'}</td>
                      {cols.map((c) => (
                        <td>
                          <NumInput
                            value={c === 'kg' ? units.show(s.kg) : s[c]}
                            placeholder={fmtPh(placeholder(s, p, c), c, units.show, s)}
                            onChange={(v) => edit((x) => { x.exercises[ei].sets[si][c] = c === 'kg' ? units.toKg(v) : v; })}
                          />
                        </td>
                      ))}
                      {settings.rpe && (
                        <td>
                          <select style="min-height:36px;padding:2px;width:58px" value={s.rpe ?? ''} aria-label="RPE"
                            onChange={(e) => {
                              const v = (e.target as HTMLSelectElement).value;
                              edit((x) => { x.exercises[ei].sets[si].rpe = v ? Number(v) : undefined; });
                            }}>
                            <option value="">-</option>
                            {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => <option value={r}>{r}</option>)}
                          </select>
                        </td>
                      )}
                      <td><button class="check" aria-label="סיום סט" onClick={() => toggleDone(ei, si)}>✓</button></td>
                    </SwipeRow>
                  );
                })}
              </tbody>
            </table>
            <button class="btn block small" style="margin-top:8px" onClick={() => edit((x) => {
              const sets = x.exercises[ei].sets;
              const last = sets[sets.length - 1];
              sets.push(last
                ? { type: last.type === 'warmup' ? 'normal' : last.type, tkg: last.kg ?? last.tkg, treps: last.reps ?? last.treps, tsecs: last.secs ?? last.tsecs, tkm: last.km ?? last.tkm }
                : { type: 'normal' });
            })}>+ הוסף סט</button>
          </div>
        );
      })}

      <button class="btn primary block" style="margin-top:14px" onClick={() => setPicker(true)}>+ הוסף תרגיל</button>
      {picker && <ExercisePicker onClose={() => setPicker(false)} onAdd={addExercises} />}

      {menuFor != null && menuEx && (
        <Menu onClose={() => setMenuFor(null)} items={[
          { label: 'הערה', icon: '📝', onClick: () => setNoteFor(menuFor) },
          { label: 'טיימר מנוחה', icon: '⏱', onClick: () => setRestFor(menuFor) },
          {
            label: menuEx.supersetId ? 'הוצא מסופרסט' : 'סופרסט עם התרגיל הבא', icon: '🔗',
            onClick: () => edit((x) => {
              const a = x.exercises[menuFor];
              if (a.supersetId) { a.supersetId = undefined; return; }
              const b = x.exercises[menuFor + 1];
              const g = b?.supersetId ?? uid();
              a.supersetId = g;
              if (b) b.supersetId = g;
            }),
          },
          ...(columnsFor(menuLib?.type ?? 'weight_reps').includes('kg') ? [{
            label: 'הוסף סטי חימום', icon: '🔥',
            onClick: () => edit((x) => {
              const ex = x.exercises[menuFor];
              const work = Math.max(0, ...ex.sets.map((s) => s.kg ?? s.tkg ?? 0),
                ...previousSets(ex.exerciseId, props.history).map((s) => s.kg ?? 0));
              if (!work) { alert('הכנס קודם משקל עבודה בסט.'); return; }
              ex.sets = [...warmupSets(work, settings.warmupRule).map((s) => ({ type: s.type, tkg: s.kg, treps: s.reps })), ...ex.sets];
            }),
          }] : []),
          ...(menuLib?.equipment === 'barbell' ? [{ label: 'מחשבון צלחות', icon: '🏋️', onClick: () => setPlatesFor(menuFor) }] : []),
          ...(menuFor > 0 ? [{ label: 'הזז למעלה', icon: '↑', onClick: () => edit((x) => { const [a] = x.exercises.splice(menuFor, 1); x.exercises.splice(menuFor - 1, 0, a); }) }] : []),
          ...(menuFor < w.exercises.length - 1 ? [{ label: 'הזז למטה', icon: '↓', onClick: () => edit((x) => { const [a] = x.exercises.splice(menuFor, 1); x.exercises.splice(menuFor + 1, 0, a); }) }] : []),
          { label: 'הסר תרגיל', icon: '🗑', danger: true, onClick: () => edit((x) => { x.exercises.splice(menuFor, 1); }) },
        ]} />
      )}

      {typeFor && (
        <Menu onClose={() => setTypeFor(null)} items={(['warmup', 'normal', 'failure', 'drop'] as SetType[]).map((t) => ({
          label: `${SET_TYPE[t].letter || '1'}  ${SET_TYPE[t].label}`,
          onClick: () => edit((x) => { x.exercises[typeFor[0]].sets[typeFor[1]].type = t; }),
        }))} />
      )}

      {noteFor != null && (
        <NoteSheet initial={w.exercises[noteFor]?.note ?? ''} exercise={lib.get(w.exercises[noteFor]?.exerciseId)}
          onClose={() => setNoteFor(null)}
          onSave={(text, pin) => {
            edit((x) => { x.exercises[noteFor].note = text || undefined; });
            const ex = lib.get(w.exercises[noteFor].exerciseId);
            if (pin && ex) void db.exercises.update(ex.id, { note: text || undefined });
          }} />
      )}

      {restFor != null && (
        <Sheet title="טיימר מנוחה" onClose={() => setRestFor(null)}>
          <select size={8} style="height:auto" value={w.exercises[restFor]?.restSec ?? 0}
            onChange={(e) => {
              const v = Number((e.target as HTMLSelectElement).value);
              edit((x) => { x.exercises[restFor].restSec = v || undefined; });
              setRestFor(null);
            }}>
            {restOptions().map((o) => <option value={o}>{fmtRest(o)}</option>)}
          </select>
        </Sheet>
      )}

      {platesFor != null && <PlatesSheet settings={settings}
        initial={Math.max(0, ...w.exercises[platesFor].sets.map((s) => s.kg ?? s.tkg ?? 0)) || 60}
        onClose={() => setPlatesFor(null)} />}
    </div>
  );
}

function fmtPrev(p: WSet, cols: Col[], show: (n?: number) => number | undefined): string {
  if (cols.includes('kg') && cols.includes('reps')) return `${show(p.kg) ?? 0}×${p.reps ?? 0}`;
  return cols.map((c) => (c === 'kg' ? show(p.kg) : p[c]) ?? '').join(' / ');
}
function fmtPh(v: number | undefined, c: Col, show: (n?: number) => number | undefined, s: WSet): string {
  if (v == null) return '';
  if (c === 'reps' && s.trepsMax && s.treps === v) return `${v}-${s.trepsMax}`;
  return String(c === 'kg' ? show(v) : v);
}

export function NumInput(props: { value?: number; placeholder?: string; onChange: (v?: number) => void }) {
  return (
    <input type="number" inputMode="decimal" step="any" value={props.value ?? ''} placeholder={props.placeholder}
      onInput={(e) => {
        const t = (e.target as HTMLInputElement).value;
        props.onChange(t === '' ? undefined : Number(t));
      }} />
  );
}

/** A table row you can swipe to the side to delete. */
function SwipeRow(props: { done: boolean; onDelete: () => void; children: any }) {
  const start = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  return (
    <tr class={(props.done ? 'done ' : '') + 'swipe'} style={dx ? `transform:translateX(${dx}px);opacity:${1 - Math.min(0.6, Math.abs(dx) / 200)}` : ''}
      onTouchStart={(e) => { start.current = e.touches[0].clientX; }}
      onTouchMove={(e) => { if (start.current != null) setDx(e.touches[0].clientX - start.current); }}
      onTouchEnd={() => {
        if (Math.abs(dx) > 90) props.onDelete();
        setDx(0);
        start.current = null;
      }}>
      {props.children}
    </tr>
  );
}

function NoteSheet(props: { initial: string; exercise?: Exercise; onClose: () => void; onSave: (t: string, pin: boolean) => void }) {
  const [t, setT] = useState(props.initial);
  const [pin, setPin] = useState(!!props.exercise?.note);
  return (
    <Sheet title="הערה לתרגיל" onClose={props.onClose}>
      <textarea rows={4} dir="auto" value={t} onInput={(e) => setT((e.target as HTMLTextAreaElement).value)} />
      <label class="row" style="margin-top:10px">
        <input type="checkbox" checked={pin} onChange={(e) => setPin((e.target as HTMLInputElement).checked)} />
        נעץ לתרגיל (יופיע בכל פעם שארשום אותו)
      </label>
      <button class="btn primary block" style="margin-top:12px" onClick={() => { props.onSave(t.trim(), pin); props.onClose(); }}>שמור</button>
    </Sheet>
  );
}

export function PlatesSheet(props: { settings: Settings; initial: number; onClose: () => void }) {
  const [kg, setKg] = useState(props.initial);
  const r = plates(kg, props.settings.barKg, props.settings.plates);
  return (
    <Sheet title="מחשבון צלחות" onClose={props.onClose}>
      <label class="field"><span>משקל כולל (ק"ג)</span>
        <NumInput value={kg} onChange={(v) => setKg(v ?? 0)} />
      </label>
      <p>מוט: {props.settings.barKg} ק"ג. בכל צד:</p>
      <div class="row wrap">
        {r.perSide.length ? r.perSide.map((p) => <span class="chip blue" style="font-size:16px;padding:6px 10px">{p}</span>) : <span class="muted">בלי צלחות</span>}
      </div>
      {Math.abs(r.achieved - kg) > 0.001 && (
        <p class="error">אי אפשר להגיע בדיוק ל־{kg}. הכי קרוב: {r.achieved} ק"ג.</p>
      )}
    </Sheet>
  );
}
