import { useEffect, useState } from 'preact/hooks';
import { db, uid } from '../lib/db';
import { saveBjj } from '../lib/actions';
import { BJJ_TYPE } from '../lib/labels';
import type { BjjType } from '../lib/types';
import { nav } from '../hooks';
import { Seg, TopBar } from '../components/ui';
import { NumInput } from '../components/WorkoutEditor';

const toLocal = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function BjjForm(props: { id?: string }) {
  const [id] = useState(props.id ?? uid());
  const [start, setStart] = useState(toLocal(Date.now()));
  const [type, setType] = useState<BjjType>('gi');
  const [minutes, setMinutes] = useState<number | undefined>(90);
  const [intensity, setIntensity] = useState(7);
  const [summary, setSummary] = useState('');
  const [loaded, setLoaded] = useState(!props.id);

  useEffect(() => {
    if (!props.id) {
      // restore an unsaved draft
      try {
        const d = JSON.parse(localStorage.getItem('bjj-draft') ?? 'null');
        if (d?.summary) setSummary(d.summary);
      } catch { /* ignore */ }
      return;
    }
    void db.bjj.get(props.id).then((b) => {
      if (b) {
        setStart(toLocal(b.start)); setType(b.type); setMinutes(b.minutes); setIntensity(b.intensity); setSummary(b.summary);
      }
      setLoaded(true);
    });
  }, [props.id]);

  useEffect(() => {
    if (props.id) return;
    try { localStorage.setItem('bjj-draft', JSON.stringify({ summary })); } catch { /* ignore */ }
  }, [summary]);

  if (!loaded) return <div class="page" />;
  const canSave = summary.trim().length > 0;
  return (
    <div class="page">
      <TopBar title={props.id ? "עריכת אימון ג'יו־ג'יטסו" : "אימון ג'יו־ג'יטסו"} backTo right={
        <button class="btn purple small" disabled={!canSave} onClick={async () => {
          await saveBjj({ id, start: new Date(start).getTime() || Date.now(), type, minutes: minutes ?? 0, intensity, summary: summary.trim() });
          try { localStorage.removeItem('bjj-draft'); } catch { /* ignore */ }
          nav('b/' + id, true);
        }}>שמור</button>
      } />
      <Seg value={type} options={(Object.keys(BJJ_TYPE) as BjjType[]).map((k) => [k, BJJ_TYPE[k]])} onChange={setType} />
      <div class="row" style="margin-top:4px">
        <label class="field grow"><span>מתי</span>
          <input type="datetime-local" value={start} onInput={(e) => setStart((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field" style="width:96px"><span>דקות</span>
          <NumInput value={minutes} onChange={setMinutes} />
        </label>
      </div>
      <label class="field"><span>קושי: <b>{intensity}</b>/10</span>
        <input type="range" min={1} max={10} value={intensity} style="width:100%"
          onInput={(e) => setIntensity(Number((e.target as HTMLInputElement).value))} />
      </label>
      <label class="field"><span>סיכום האימון (אפשר להכתיב במיקרופון של המקלדת)</span>
        <textarea dir="auto" rows={14} value={summary} placeholder="מה עשינו, עם מי גלגלתי, מה עבד, מה לא…"
          onInput={(e) => setSummary((e.target as HTMLTextAreaElement).value)} style="min-height:45vh" />
      </label>
    </div>
  );
}
