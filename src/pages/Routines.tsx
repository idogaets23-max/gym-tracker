import { useEffect, useState } from 'preact/hooks';
import { db, uid } from '../lib/db';
import { estimateRoutineSecs, fmtDuration, fmtRest, muscleSets, restOptions } from '../lib/calc';
import { getLive, startFromRoutine } from '../lib/actions';
import { SET_TYPE, columnsFor, COLUMN_LABEL } from '../lib/labels';
import type { Exercise, Folder, RExercise, Routine, SetType } from '../lib/types';
import { nav, useExerciseMap, useLive, useUnits } from '../hooks';
import { ExercisePicker } from '../components/ExercisePicker';
import { MuscleSummary } from '../components/charts';
import { NumInput } from '../components/WorkoutEditor';
import { Confirm, Empty, Menu, Sheet, TopBar } from '../components/ui';

export function repsText(e: RExercise): string {
  const n = e.sets.length;
  const sets = `${n} ${n === 1 ? 'סט' : 'סטים'}`;
  if (e.repsMode === 'range') {
    const mins = e.sets.map((s) => s.repsMin).filter((x): x is number => x != null);
    const maxs = e.sets.map((s) => s.repsMax).filter((x): x is number => x != null);
    if (mins.length && maxs.length) return `${sets} · ${Math.min(...mins)}-${Math.max(...maxs)} חזרות`;
  } else {
    const reps = e.sets.map((s) => s.reps).filter((x): x is number => x != null);
    if (reps.length) return `${sets} · ${Math.min(...reps) === Math.max(...reps) ? reps[0] : `${Math.min(...reps)}-${Math.max(...reps)}`} חזרות`;
  }
  return sets;
}

export function RoutinesPage() {
  const routines = useLive(() => db.routines.orderBy('order').toArray(), []);
  const folders = useLive(() => db.folders.orderBy('order').toArray(), []) ?? [];
  const lib = useExerciseMap();
  const [menu, setMenu] = useState<Routine | null>(null);
  const [del, setDel] = useState<Routine | null>(null);
  const [move, setMove] = useState<Routine | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderMenu, setFolderMenu] = useState<Folder | null>(null);
  if (!routines || !lib) return <div class="page" />;

  const groups: { folder: Folder | null; items: Routine[] }[] = [
    ...folders.map((f) => ({ folder: f, items: routines.filter((r) => r.folderId === f.id) })),
    { folder: null, items: routines.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId)) },
  ];

  return (
    <div class="page">
      <TopBar title="רוטינות" />
      <div class="row">
        <button class="btn primary grow" onClick={() => nav('routines/new')}>+ רוטינה חדשה</button>
        <button class="btn" onClick={() => setNewFolder(true)}>+ תיקייה</button>
      </div>
      {!routines.length && <Empty icon="🗂" text="אין עדיין רוטינות. רוטינה היא תוכנית אימון שבונים פעם אחת ומתחילים ממנה כל שבוע." />}
      {groups.map((g) => (
        (g.folder || g.items.length > 0) && (
          <div>
            <div class="row between" style="margin-top:14px">
              <button class="link" style="color:var(--text)" onClick={() => g.folder && db.folders.update(g.folder.id, { collapsed: !g.folder.collapsed })}>
                {g.folder ? (g.folder.collapsed ? '◂ ' : '▾ ') : ''}<b>{g.folder ? g.folder.name : 'הרוטינות שלי'}</b> <span class="muted">({g.items.length})</span>
              </button>
              {g.folder && <button class="icon-btn" aria-label="תפריט תיקייה" onClick={() => setFolderMenu(g.folder)}>⋯</button>}
            </div>
            {!g.folder?.collapsed && g.items.map((r) => (
              <div class="card row">
                <div class="grow tap" style="cursor:pointer" onClick={() => nav('routines/' + r.id)}>
                  <b>{r.title}</b>
                  <div class="muted small ltr" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:start">
                    {r.exercises.map((e) => lib.get(e.exerciseId)?.name).filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
                <button class="icon-btn" aria-label="תפריט רוטינה" onClick={() => setMenu(r)}>⋯</button>
              </div>
            ))}
          </div>
        )
      ))}
      {menu && <RoutineMenu r={menu} onClose={() => setMenu(null)} onDelete={() => setDel(menu)} onMove={() => setMove(menu)} />}
      {del && (
        <Confirm title={`למחוק את "${del.title}"?`} text="אימונים שכבר נשמרו לא ייפגעו." yes="מחק" no="ביטול" danger
          onNo={() => setDel(null)} onYes={async () => { await db.routines.delete(del.id); setDel(null); }} />
      )}
      {move && (
        <Menu onClose={() => setMove(null)} items={[
          { label: 'הרוטינות שלי (בלי תיקייה)', onClick: () => db.routines.update(move.id, { folderId: undefined }) },
          ...folders.map((f) => ({ label: f.name, onClick: () => db.routines.update(move.id, { folderId: f.id }) })),
        ]} />
      )}
      {newFolder && <NameSheet title="תיקייה חדשה" onClose={() => setNewFolder(false)}
        onSave={(name) => db.folders.add({ id: uid(), name, order: Date.now() })} />}
      {folderMenu && (
        <Menu onClose={() => setFolderMenu(null)} items={[{
          label: 'מחק תיקייה (הרוטינות עוברות ל"הרוטינות שלי")', danger: true,
          onClick: async () => {
            await db.transaction('rw', db.routines, db.folders, async () => {
              await db.routines.where('folderId').equals(folderMenu.id).modify({ folderId: undefined });
              await db.folders.delete(folderMenu.id);
            });
          },
        }]} />
      )}
    </div>
  );
}

function NameSheet(props: { title: string; onClose: () => void; onSave: (n: string) => void }) {
  const [n, setN] = useState('');
  return (
    <Sheet title={props.title} onClose={props.onClose}>
      <input type="text" dir="auto" value={n} onInput={(e) => setN((e.target as HTMLInputElement).value)} />
      <button class="btn primary block" style="margin-top:10px" disabled={!n.trim()} onClick={() => { props.onSave(n.trim()); props.onClose(); }}>שמור</button>
    </Sheet>
  );
}

function RoutineMenu(props: { r: Routine; onClose: () => void; onDelete: () => void; onMove: () => void }) {
  return (
    <Menu onClose={props.onClose} items={[
      { label: 'ערוך', icon: '✎', onClick: () => nav(`routines/${props.r.id}/edit`) },
      {
        label: 'שכפל', icon: '⧉',
        onClick: () => db.routines.add({ ...structuredClone(props.r), id: uid(), title: `${props.r.title} (עותק)`, order: Date.now(), updatedAt: Date.now() }),
      },
      { label: 'העבר לתיקייה', icon: '📁', onClick: props.onMove },
      { label: 'מחק', icon: '🗑', danger: true, onClick: props.onDelete },
    ]} />
  );
}

export function RoutineDetail(props: { id: string }) {
  const r = useLive(() => db.routines.get(props.id), [props.id]);
  const lib = useExerciseMap();
  const live = useLive(getLive, []);
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  if (r === undefined || !lib) return <div class="page" />;
  if (!r) return <div class="page"><TopBar title="הרוטינה לא נמצאה" backTo="routines" /></div>;
  return (
    <div class="page">
      <TopBar title={r.title} backTo="routines" right={<button class="icon-btn" aria-label="תפריט" onClick={() => setMenu(true)}>⋯</button>} />
      <button class="btn primary block" disabled={!!live || !r.exercises.length}
        onClick={async () => { await startFromRoutine(r); nav('live'); }}>
        {live ? 'יש כבר אימון פעיל' : 'התחל אימון'}
      </button>
      {r.exercises.map((e) => (
        <div class="ex-row" onClick={() => nav('exercises/' + e.exerciseId)}>
          <div class="thumb">{(lib.get(e.exerciseId)?.name ?? '?').slice(0, 2).toUpperCase()}</div>
          <div class="grow">
            <div class="ex-name">{lib.get(e.exerciseId)?.name}</div>
            <div class="muted small">{repsText(e)}{e.restSec ? ` · ⏱ מנוחה ${fmtRest(e.restSec)}` : ''}</div>
          </div>
        </div>
      ))}
      {menu && <RoutineMenu r={r} onClose={() => setMenu(false)} onDelete={() => setDel(true)} onMove={() => nav(`routines`)} />}
      {del && (
        <Confirm title="למחוק את הרוטינה?" text="אימונים שכבר נשמרו לא ייפגעו." yes="מחק" no="ביטול" danger
          onNo={() => setDel(false)} onYes={async () => { await db.routines.delete(r.id); nav('routines', true); }} />
      )}
    </div>
  );
}

export function RoutineEditor(props: { id?: string }) {
  const lib = useExerciseMap();
  const units = useUnits();
  const [r, setR] = useState<Routine | null>(null);
  const [picker, setPicker] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [typeFor, setTypeFor] = useState<[number, number] | null>(null);
  const [restFor, setRestFor] = useState<number | null>(null);
  const [repsFor, setRepsFor] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [summary, setSummary] = useState(false);

  useEffect(() => {
    if (props.id) void db.routines.get(props.id).then((x) => x && setR(structuredClone(x)));
    else setR({ id: uid(), title: '', order: Date.now(), exercises: [], updatedAt: Date.now() });
  }, [props.id]);

  if (!r || !lib) return <div class="page" />;
  const change = (fn: (x: Routine) => void) => { const c = structuredClone(r); fn(c); setR(c); };
  const canSave = r.title.trim() && r.exercises.length > 0;

  return (
    <div class="page">
      <TopBar title={props.id ? 'עריכת רוטינה' : 'רוטינה חדשה'} backTo right={
        <button class="btn primary small" disabled={!canSave} onClick={async () => {
          await db.routines.put({ ...r, title: r.title.trim(), updatedAt: Date.now() });
          nav('routines/' + r.id, true);
        }}>שמור</button>
      } />
      <input type="text" dir="auto" placeholder="שם הרוטינה" value={r.title} onInput={(e) => change((x) => { x.title = (e.target as HTMLInputElement).value; })} />
      <button class="card tap row between" style="width:100%;margin-top:10px;text-align:start" onClick={() => setSummary(true)}>
        <span>תרגילים <b>{r.exercises.length}</b></span>
        <span>סטים <b>{r.exercises.reduce((a, e) => a + e.sets.length, 0)}</b></span>
        <span>~<b>{fmtDuration(estimateRoutineSecs(r.exercises))}</b></span>
        <span class="link">סיכום ‹</span>
      </button>
      {!r.exercises.length && <Empty icon="🏋️" text="התחל בהוספת תרגיל לרוטינה." />}
      {r.exercises.map((e, ei) => {
        const ex = lib.get(e.exerciseId);
        const cols = columnsFor(ex?.type ?? 'weight_reps');
        let n = 0;
        return (
          <div class={'block' + (e.supersetId ? ' superset' : '')}>
            <div class="row">
              <div class="grow">
                <div class="ex-name" style="color:var(--blue)">{ex?.name}</div>
                <button class="link small" onClick={() => setRestFor(ei)}>⏱ מנוחה: {fmtRest(e.restSec)}</button>
              </div>
              <button class="icon-btn" aria-label="תפריט" onClick={() => setMenuFor(ei)}>⋮</button>
            </div>
            {e.note && <div class="note">📌 {e.note}</div>}
            <table class="sets">
              <thead><tr>
                <th>סט</th>
                {cols.map((c) => c === 'reps'
                  ? <th><button class="link small" onClick={() => setRepsFor(ei)}>{e.repsMode === 'range' ? 'טווח חזרות' : 'חזרות'} ▾</button></th>
                  : <th>{c === 'kg' ? units.label : COLUMN_LABEL[c]}</th>)}
                <th />
              </tr></thead>
              <tbody>
                {e.sets.map((s, si) => {
                  if (s.type === 'normal') n++;
                  return (
                    <tr>
                      <td><button class="settype" style={`color:${SET_TYPE[s.type].color}`} onClick={() => setTypeFor([ei, si])}>{s.type === 'normal' ? n : SET_TYPE[s.type].letter}</button></td>
                      {cols.map((c) => (
                        <td>
                          {c === 'reps' && e.repsMode === 'range' ? (
                            <div class="row" style="gap:2px">
                              <NumInput value={s.repsMin} placeholder="מ־" onChange={(v) => change((x) => { x.exercises[ei].sets[si].repsMin = v; })} />
                              <NumInput value={s.repsMax} placeholder="עד" onChange={(v) => change((x) => { x.exercises[ei].sets[si].repsMax = v; })} />
                            </div>
                          ) : (
                            <NumInput value={c === 'kg' ? units.show(s.kg) : s[c]}
                              onChange={(v) => change((x) => { x.exercises[ei].sets[si][c] = c === 'kg' ? units.toKg(v) : v; })} />
                          )}
                        </td>
                      ))}
                      <td><button class="icon-btn" aria-label="מחק סט" onClick={() => change((x) => { x.exercises[ei].sets.splice(si, 1); })}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {e.repsMode === 'range' && e.sets.some((s) => s.repsMin != null && s.repsMax != null && s.repsMin > s.repsMax) && (
              <p class="error">המינימום חייב להיות קטן או שווה למקסימום.</p>
            )}
            <button class="btn block small" style="margin-top:8px" onClick={() => change((x) => {
              const sets = x.exercises[ei].sets;
              const last = sets[sets.length - 1];
              sets.push(last ? { ...last, type: last.type === 'warmup' ? 'normal' : last.type } : { type: 'normal' });
            })}>+ הוסף סט</button>
          </div>
        );
      })}
      <button class="btn primary block" style="margin-top:14px" onClick={() => setPicker(true)}>+ הוסף תרגיל</button>
      {picker && <ExercisePicker onClose={() => setPicker(false)} onAdd={(ids) => change((x) => {
        for (const id of ids) x.exercises.push({ exerciseId: id, sets: [{ type: 'normal' }], repsMode: 'reps', note: lib.get(id)?.note });
      })} />}
      {menuFor != null && (
        <Menu onClose={() => setMenuFor(null)} items={[
          {
            label: r.exercises[menuFor].supersetId ? 'הוצא מסופרסט' : 'סופרסט עם התרגיל הבא', icon: '🔗',
            onClick: () => change((x) => {
              const a = x.exercises[menuFor];
              if (a.supersetId) { a.supersetId = undefined; return; }
              const b = x.exercises[menuFor + 1];
              const g = b?.supersetId ?? uid();
              a.supersetId = g;
              if (b) b.supersetId = g;
            }),
          },
          { label: 'הערה', icon: '📝', onClick: () => setNoteFor(menuFor) },
          ...(menuFor > 0 ? [{ label: 'הזז למעלה', icon: '↑', onClick: () => change((x) => { const [a] = x.exercises.splice(menuFor, 1); x.exercises.splice(menuFor - 1, 0, a); }) }] : []),
          ...(menuFor < r.exercises.length - 1 ? [{ label: 'הזז למטה', icon: '↓', onClick: () => change((x) => { const [a] = x.exercises.splice(menuFor, 1); x.exercises.splice(menuFor + 1, 0, a); }) }] : []),
          { label: 'הסר תרגיל', icon: '🗑', danger: true, onClick: () => change((x) => { x.exercises.splice(menuFor, 1); }) },
        ]} />
      )}
      {typeFor && (
        <Menu onClose={() => setTypeFor(null)} items={(['warmup', 'normal', 'failure', 'drop'] as SetType[]).map((t) => ({
          label: `${SET_TYPE[t].letter || '1'}  ${SET_TYPE[t].label}`,
          onClick: () => change((x) => { x.exercises[typeFor[0]].sets[typeFor[1]].type = t; }),
        }))} />
      )}
      {repsFor != null && (
        <Menu onClose={() => setRepsFor(null)} items={[
          { label: 'טווח חזרות', onClick: () => change((x) => { x.exercises[repsFor].repsMode = 'range'; }) },
          { label: 'חזרות', onClick: () => change((x) => { x.exercises[repsFor].repsMode = 'reps'; }) },
        ]} />
      )}
      {restFor != null && (
        <Sheet title="טיימר מנוחה" onClose={() => setRestFor(null)}>
          <select size={8} style="height:auto" value={r.exercises[restFor]?.restSec ?? 0}
            onChange={(e) => { const v = Number((e.target as HTMLSelectElement).value); change((x) => { x.exercises[restFor].restSec = v || undefined; }); setRestFor(null); }}>
            {restOptions().map((o) => <option value={o}>{fmtRest(o)}</option>)}
          </select>
        </Sheet>
      )}
      {noteFor != null && (
        <NoteEdit initial={r.exercises[noteFor].note ?? ''} onClose={() => setNoteFor(null)}
          onSave={(t) => change((x) => { x.exercises[noteFor].note = t || undefined; })} />
      )}
      {summary && <RoutineSummarySheet r={r} lib={lib} onClose={() => setSummary(false)} />}
    </div>
  );
}

function NoteEdit(props: { initial: string; onClose: () => void; onSave: (t: string) => void }) {
  const [t, setT] = useState(props.initial);
  return (
    <Sheet title="הערה לתרגיל ברוטינה" onClose={props.onClose}>
      <textarea rows={4} dir="auto" value={t} onInput={(e) => setT((e.target as HTMLTextAreaElement).value)} />
      <button class="btn primary block" style="margin-top:10px" onClick={() => { props.onSave(t.trim()); props.onClose(); }}>שמור</button>
    </Sheet>
  );
}

function RoutineSummarySheet(props: { r: Routine; lib: Map<string, Exercise>; onClose: () => void }) {
  const data = muscleSets(props.r.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((s) => s.type !== 'warmup').length })), props.lib);
  return (
    <Sheet title="סיכום רוטינה" onClose={props.onClose}>
      <div class="stats">
        <div><b>{props.r.exercises.length}</b><span>תרגילים</span></div>
        <div><b>{props.r.exercises.reduce((a, e) => a + e.sets.length, 0)}</b><span>סטים</span></div>
        <div><b>{fmtDuration(estimateRoutineSecs(props.r.exercises))}</b><span>משך משוער</span></div>
      </div>
      <MuscleSummary data={data} />
    </Sheet>
  );
}
