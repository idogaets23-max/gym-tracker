import { useState } from 'preact/hooks';
import { db, saveSettings } from '../lib/db';
import { exportData, importData } from '../lib/backup';
import { explainError, getCoachConfig, gh, setCoachConfig, syncAll } from '../lib/sync';
import { fmtRest, restOptions } from '../lib/calc';
import type { Settings } from '../lib/types';
import { useLive, useSettings } from '../hooks';
import { Confirm, Seg, TopBar } from '../components/ui';

export function SettingsPage() {
  const s = useSettings();
  const set = (patch: Partial<Settings>) => saveSettings({ ...s, ...patch });
  const [warm, setWarm] = useState<string | null>(null);
  const [plates, setPlates] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [importText, setImportText] = useState<string | null>(null);

  return (
    <div class="page">
      <TopBar title="הגדרות" backTo="profile" />

      <h2>אימון</h2>
      <div class="card stack">
        <div><div class="small muted">יחידות</div>
          <Seg value={s.units} options={[['kg', 'ק"ג'], ['lb', 'lb']]} onChange={(v) => set({ units: v })} /></div>
        <label class="field"><span>טיימר מנוחה לתרגיל חדש</span>
          <select value={s.defaultRestSec} onChange={(e) => set({ defaultRestSec: Number((e.target as HTMLSelectElement).value) })}>
            {restOptions().map((o) => <option value={o}>{fmtRest(o)}</option>)}
          </select>
        </label>
        <Toggle label="צליל בסוף המנוחה" on={s.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label="RPE לכל סט" on={s.rpe} onChange={(v) => set({ rpe: v })} />
        <Toggle label="הודעה על שיא חדש בזמן האימון" on={s.liveRecords} onChange={(v) => set({ liveRecords: v })} />
        <div><div class="small muted">השבוע מתחיל ב־</div>
          <Seg value={s.weekStart} options={[[0, 'ראשון'], [1, 'שני']]} onChange={(v) => set({ weekStart: v })} /></div>
      </div>

      <h2>מחשבונים</h2>
      <div class="card stack">
        <label class="field"><span>סטי חימום: אחוז×חזרות, מופרדים בפסיק</span>
          <input type="text" dir="ltr" value={warm ?? s.warmupRule.map((r) => `${r.pct}x${r.reps}`).join(', ')}
            onInput={(e) => setWarm((e.target as HTMLInputElement).value)}
            onBlur={() => {
              if (warm == null) return;
              const rule = warm.split(',').map((p) => p.trim().match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+)$/)).filter(Boolean)
                .map((m) => ({ pct: Number(m![1]), reps: Number(m![2]) }));
              if (rule.length) set({ warmupRule: rule });
              setWarm(null);
            }} />
        </label>
        <label class="field"><span>משקל המוט (ק"ג)</span>
          <input type="number" inputMode="decimal" value={s.barKg} onInput={(e) => set({ barKg: Number((e.target as HTMLInputElement).value) || 0 })} />
        </label>
        <label class="field"><span>צלחות שיש בחדר (ק"ג, מופרדות בפסיק)</span>
          <input type="text" dir="ltr" value={plates ?? s.plates.join(', ')} onInput={(e) => setPlates((e.target as HTMLInputElement).value)}
            onBlur={() => {
              if (plates == null) return;
              const list = plates.split(',').map((x) => Number(x.trim())).filter((x) => x > 0);
              if (list.length) set({ plates: list.sort((a, b) => b - a) });
              setPlates(null);
            }} />
        </label>
      </div>

      <h2>חיבור למאמן</h2>
      <CoachLink />

      <h2>גיבוי</h2>
      <div class="card stack">
        <button class="btn block" onClick={async () => {
          const blob = new Blob([await exportData()], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `gym-tracker-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        }}>ייצוא כל הנתונים (JSON)</button>
        <label class="btn block center" style="display:block;line-height:24px">
          ייבוא מקובץ גיבוי
          <input type="file" accept="application/json,.json" style="display:none" onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) setImportText(await f.text());
            (e.target as HTMLInputElement).value = '';
          }} />
        </label>
        {msg && <p class="ok">{msg}</p>}
        {err && <p class="error">{err}</p>}
      </div>
      {importText != null && (
        <Confirm title="לייבא את הגיבוי?" text="כל הנתונים באפליקציה יוחלפו בנתונים מהקובץ." yes="ייבא" no="ביטול" danger
          onNo={() => setImportText(null)}
          onYes={async () => {
            try { await importData(importText); setMsg('הגיבוי יובא.'); setErr(''); }
            catch (e) { setErr((e as Error).message); setMsg(''); }
            setImportText(null);
          }} />
      )}
      <p class="muted small center" style="margin-top:20px">Gym Tracker · {__BUILD__}</p>
    </div>
  );
}

function Toggle(props: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="row between" style="min-height:40px">
      <span>{props.label}</span>
      <input type="checkbox" style="width:22px;height:22px" checked={props.on} onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)} />
    </label>
  );
}

function CoachLink() {
  const cfg = useLive(getCoachConfig, []);
  const queue = useLive(() => db.outbox.count(), []) ?? 0;
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [state, setState] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState(false);

  async function test(c: { repo: string; token: string }) {
    setBusy(true);
    try {
      const info = await gh(c).repoInfo();
      if (!info.private) { setState({ err: 'הריפו ציבורי. האימונים שלך היו נחשפים. הפוך אותו ל־Private ב־GitHub.' }); return false; }
      setState({ ok: `מחובר ל־${info.full_name}` });
      return true;
    } catch (e) {
      setState({ err: explainError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (cfg === undefined) return null;
  if (cfg) {
    return (
      <div class="card stack">
        <div>מחובר לריפו <b class="ltr">{cfg.repo}</b>. ה־token שמור רק בטלפון הזה.</div>
        <div class="small muted">ממתינים לשליחה: {queue}</div>
        <div class="row">
          <button class="btn grow" disabled={busy} onClick={() => test(cfg)}>בדוק חיבור</button>
          <button class="btn grow" disabled={busy} onClick={async () => {
            setBusy(true);
            const e = await syncAll();
            setBusy(false);
            setState(e ? { err: e } : { ok: 'סונכרן.' });
          }}>סנכרן עכשיו</button>
        </div>
        <button class="btn danger block" onClick={async () => { await setCoachConfig(null); setState({}); }}>נתק (מוחק את ה־token מהטלפון)</button>
        {state.ok && <p class="ok">{state.ok}</p>}
        {state.err && <p class="error">{state.err}</p>}
      </div>
    );
  }
  return (
    <div class="card stack">
      <p class="small muted" style="margin:0">ריפו פרטי ב־GitHub שדרכו האימונים מגיעים למאמן, והתשובות וההכנה חוזרות. מזינים פעם אחת.</p>
      <label class="field"><span>ריפו (owner/name)</span>
        <input type="text" dir="ltr" autocapitalize="off" autocorrect="off" placeholder="username/gym-data" value={repo}
          onInput={(e) => setRepo((e.target as HTMLInputElement).value.trim())} />
      </label>
      <label class="field"><span>GitHub token (fine-grained, רק לריפו הזה, Contents: Read and write)</span>
        <input type="password" dir="ltr" autocomplete="off" value={token} onInput={(e) => setToken((e.target as HTMLInputElement).value.trim())} />
      </label>
      <button class="btn primary block" disabled={busy || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !token} onClick={async () => {
        const c = { repo, token };
        if (await test(c)) { await setCoachConfig(c); setToken(''); void syncAll(); }
      }}>בדוק ושמור</button>
      {state.ok && <p class="ok">{state.ok}</p>}
      {state.err && <p class="error">{state.err}</p>}
    </div>
  );
}
