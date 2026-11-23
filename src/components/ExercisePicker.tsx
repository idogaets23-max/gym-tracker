import { useMemo, useState } from 'preact/hooks';
import { db } from '../lib/db';
import { EQUIPMENT, MUSCLE } from '../lib/labels';
import { filterExercises } from '../lib/search';
import type { Equipment, Exercise, Muscle } from '../lib/types';
import { useLive, nav } from '../hooks';
import { Sheet } from './ui';

export function ExerciseList(props: {
  onPick: (e: Exercise) => void;
  selected?: Set<string>;
}) {
  const all = useLive(() => db.exercises.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [eq, setEq] = useState<Equipment | 'all'>('all');
  const [mu, setMu] = useState<Muscle | 'all'>('all');
  const list = useMemo(() => filterExercises(all, q, eq, mu), [all, q, eq, mu]);
  const searching = q.trim().length > 0;
  return (
    <div>
      <div class="row">
        <select value={eq} onChange={(e) => setEq((e.target as HTMLSelectElement).value as any)} aria-label="ציוד">
          <option value="all">כל הציוד</option>
          {(Object.keys(EQUIPMENT) as Equipment[]).map((k) => <option value={k}>{EQUIPMENT[k]}</option>)}
        </select>
        <select value={mu} onChange={(e) => setMu((e.target as HTMLSelectElement).value as any)} aria-label="שריר">
          <option value="all">כל השרירים</option>
          {(Object.keys(MUSCLE) as Muscle[]).map((k) => <option value={k}>{MUSCLE[k]}</option>)}
        </select>
      </div>
      <div class="row" style="margin-top:8px">
        <input type="search" placeholder="חיפוש תרגיל (באנגלית)" value={q} dir="ltr"
          onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {searching && <button class="link" onClick={() => setQ('')}>נקה</button>}
      </div>
      <h2>{searching ? 'תוצאות חיפוש' : 'כל התרגילים'} <span class="muted small">({list.length})</span></h2>
      {list.map((e) => (
        <div class={'ex-row' + (props.selected?.has(e.id) ? ' sel' : '')} onClick={() => props.onPick(e)}>
          <div class="thumb">{e.name.slice(0, 2).toUpperCase()}</div>
          <div class="grow">
            <div class="ex-name">{e.name}</div>
            <div class="muted small">{MUSCLE[e.primary]}{e.custom ? ' · שלי' : ''}</div>
          </div>
          {props.selected && <span style="font-size:22px;color:var(--blue)">{props.selected.has(e.id) ? '✓' : '+'}</span>}
        </div>
      ))}
      {!list.length && <p class="empty">אין תרגיל כזה. אפשר ליצור תרגיל משלך.</p>}
    </div>
  );
}

/** Multi-select picker in a sheet. */
export function ExercisePicker(props: { onClose: () => void; onAdd: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const set = new Set(sel);
  return (
    <Sheet onClose={props.onClose} full>
      <div class="row between">
        <button class="link" onClick={() => { props.onClose(); nav('exercises/new'); }}>+ תרגיל משלי</button>
        <button class="icon-btn" aria-label="סגור" onClick={props.onClose}>✕</button>
      </div>
      <div style="overflow:auto;flex:1">
        <ExerciseList selected={set} onPick={(e) => setSel(set.has(e.id) ? sel.filter((x) => x !== e.id) : [...sel, e.id])} />
      </div>
      <button class="btn primary block" disabled={!sel.length} style="margin-top:8px"
        onClick={() => { props.onAdd(sel); props.onClose(); }}>
        {sel.length ? `הוסף ${sel.length} תרגילים` : 'בחר תרגילים'}
      </button>
    </Sheet>
  );
}
