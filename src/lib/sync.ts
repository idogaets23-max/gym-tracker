import { db } from './db';
import { BJJ_TYPE } from './labels';
import { fmtDuration } from './calc';
import type { BjjSession, EntryKind, Exercise, OutboxItem, Workout } from './types';

export interface CoachConfig { repo: string; token: string }

export async function getCoachConfig(): Promise<CoachConfig | null> {
  const r = await db.kv.get('coach');
  const v = r?.value as CoachConfig | undefined;
  return v && v.repo && v.token ? v : null;
}
export async function setCoachConfig(c: CoachConfig | null) {
  if (c) await db.kv.put({ key: 'coach', value: c });
  else await db.kv.delete('coach');
}

// ---------- base64 for UTF-8 ----------
export function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64decode(s: string): string {
  const bin = atob(s.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---------- GitHub contents API ----------
export class GitHubError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export function explainError(e: unknown): string {
  if (e instanceof GitHubError) {
    if (e.status === 401) return 'ה־token לא תקין או שפג תוקפו.';
    if (e.status === 403) return 'ל־token אין הרשאה לריפו הזה (צריך Contents: Read and write).';
    if (e.status === 404) return 'הריפו לא נמצא. בדוק את השם (owner/gym-data) ושה־token מכסה אותו.';
    return `GitHub החזיר שגיאה ${e.status}: ${e.message}`;
  }
  if (e instanceof TypeError) return 'אין חיבור לאינטרנט או ש־GitHub לא זמין.';
  return String(e);
}

export function gh(cfg: CoachConfig, fetchFn: typeof fetch = fetch) {
  const base = `https://api.github.com/repos/${cfg.repo}`;
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  async function req(method: string, path: string, body?: unknown) {
    const res = await fetchFn(`${base}${path}`, {
      method,
      headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message ?? msg; } catch { /* ignore */ }
      throw new GitHubError(res.status, msg);
    }
    return res.status === 204 ? {} : res.json();
  }
  const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');
  return {
    async repoInfo() {
      const r = await req('GET', '');
      if (!r) throw new GitHubError(404, 'Not Found');
      return r as { private: boolean; full_name: string };
    },
    async getFile(path: string): Promise<{ sha: string; text: string } | null> {
      const r = await req('GET', `/contents/${enc(path)}`);
      if (!r || Array.isArray(r)) return null;
      return { sha: r.sha, text: b64decode(r.content ?? '') };
    },
    async listDir(path: string): Promise<{ name: string; sha: string; path: string }[]> {
      const r = await req('GET', `/contents/${enc(path)}`);
      return Array.isArray(r) ? r.filter((x: any) => x.type === 'file') : [];
    },
    async putFile(path: string, text: string, message: string) {
      const existing = await req('GET', `/contents/${enc(path)}`);
      const body: any = { message, content: b64encode(text) };
      if (existing && !Array.isArray(existing)) body.sha = existing.sha;
      return req('PUT', `/contents/${enc(path)}`, body);
    },
  };
}

// ---------- entry text for the coach ----------
function fmtSet(s: Workout['exercises'][number]['sets'][number]): string {
  const parts: string[] = [];
  if (s.kg != null) parts.push(`${s.kg} kg`);
  if (s.reps != null) parts.push(`x ${s.reps}`);
  if (s.secs != null) parts.push(`${s.secs} s`);
  if (s.km != null) parts.push(`${s.km} km`);
  let t = parts.join(' ').replace(/^x /, '') || '-';
  if (s.rpe) t += ` (RPE ${s.rpe})`;
  if (s.type === 'warmup') t = 'W ' + t;
  if (s.type === 'failure') t += ' F';
  if (s.type === 'drop') t += ' D';
  return t;
}

export function workoutText(w: Workout, lib: Map<string, Exercise>): string {
  const d = new Date(w.start);
  const lines = [
    `אימון כוח: ${w.title}`,
    `תאריך: ${d.toLocaleDateString('he-IL')} ${d.toTimeString().slice(0, 5)}`,
    `משך: ${fmtDuration(((w.end ?? w.start) - w.start) / 1000)}`,
  ];
  for (const e of w.exercises) {
    const name = lib.get(e.exerciseId)?.name ?? e.exerciseId;
    lines.push(`- ${name}: ${e.sets.map(fmtSet).join(', ')}`);
    if (e.note) lines.push(`  הערה: ${e.note}`);
  }
  return lines.join('\n');
}

export function bjjText(b: BjjSession): string {
  const d = new Date(b.start);
  return [
    `אימון ג'יו־ג'יטסו (${BJJ_TYPE[b.type]})`,
    `תאריך: ${d.toLocaleDateString('he-IL')} ${d.toTimeString().slice(0, 5)}`,
    `משך: ${b.minutes} דקות, קושי ${b.intensity}/10`,
    '',
    b.summary,
  ].join('\n');
}

// ---------- outbox ----------
export async function enqueue(kind: OutboxItem['kind'], entryId: string, rev: number, extra: Partial<OutboxItem> = {}) {
  const now = Date.now();
  await db.transaction('rw', db.outbox, db.sync, async () => {
    if (kind !== 'answer') {
      // only the newest revision of an entry needs to go out
      const old = await db.outbox.where('entryId').equals(entryId).toArray();
      await db.outbox.bulkDelete(old.filter((o) => o.kind === kind).map((o) => o.seq!));
      const s = await db.sync.get(entryId);
      await db.sync.put({ ...(s ?? { entryId }), status: 'waiting' });
    }
    await db.outbox.add({ kind, entryId, rev, createdAt: now, tries: 0, nextTry: now, ...extra });
  });
}

export const backoff = (tries: number) => Math.min(10 * 60_000, 5_000 * 2 ** tries);

async function payloadFor(item: OutboxItem): Promise<{ path: string; text: string } | null> {
  const lib = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const savedAt = new Date().toISOString();
  if (item.kind === 'answer') {
    return {
      path: `inbox/answers/${item.entryId}-${item.answerNo}.json`,
      text: JSON.stringify({ kind: 'answer', entryId: item.entryId, answerNo: item.answerNo, text: item.text, savedAt }, null, 2),
    };
  }
  const kind = item.kind as EntryKind;
  const entry = kind === 'workout' ? await db.workouts.get(item.entryId) : await db.bjj.get(item.entryId);
  const path = `inbox/${kind}/${item.entryId}.json`;
  if (!entry) return { path, text: JSON.stringify({ kind, id: item.entryId, deleted: true, savedAt }, null, 2) };
  const text = kind === 'workout' ? workoutText(entry as Workout, lib) : bjjText(entry as BjjSession);
  const rev = (entry as Workout | BjjSession).rev;
  return { path, text: JSON.stringify({ kind, id: item.entryId, rev, savedAt, text, entry }, null, 2) };
}

let running = false;
/** Upload queued items in order. Stops at the first failure so the order is kept. */
export async function processOutbox(fetchFn: typeof fetch = fetch): Promise<{ sent: number; error?: string }> {
  if (running) return { sent: 0 };
  const cfg = await getCoachConfig();
  if (!cfg) return { sent: 0 };
  running = true;
  let sent = 0;
  try {
    const api = gh(cfg, fetchFn);
    const items = await db.outbox.orderBy('seq').toArray();
    for (const item of items) {
      if (item.nextTry > Date.now()) break;
      try {
        const p = await payloadFor(item);
        if (p) await api.putFile(p.path, p.text, `${item.kind} ${item.entryId} rev ${item.rev}`);
        await db.outbox.delete(item.seq!);
        if (item.kind === 'answer') {
          const s = await db.sync.get(item.entryId);
          await db.sync.put({ ...(s ?? { entryId: item.entryId, status: 'sent' }), answersSent: item.answerNo });
        } else {
          const s = await db.sync.get(item.entryId);
          const stillQueued = await db.outbox.where('entryId').equals(item.entryId).count();
          await db.sync.put({
            ...(s ?? { entryId: item.entryId }),
            status: s?.status === 'read' && !stillQueued ? 'read' : stillQueued ? 'waiting' : 'sent',
            sentRev: item.rev,
          });
        }
        sent++;
      } catch (e) {
        await db.outbox.update(item.seq!, { tries: item.tries + 1, nextTry: Date.now() + backoff(item.tries + 1) });
        return { sent, error: explainError(e) };
      }
    }
    return { sent };
  } finally {
    running = false;
  }
}

// ---------- replies and prep ----------
export const ROUND_MARK = /^<!-- round (\d+) -->$/m;

/** Split the reply file into rounds (the watcher writes one "<!-- round N -->" line before each). */
export function replyRounds(reply: string): string[] {
  const parts = reply.split(/^<!-- round \d+ -->\s*$/m).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [reply.trim()];
}

/** Questions in the last round: numbered or bulleted lines under a "שאלות" heading. */
export function lastQuestions(reply: string): string[] {
  const rounds = replyRounds(reply);
  const last = rounds[rounds.length - 1] ?? '';
  const m = last.match(/^#{1,4}\s*שאלות.*$/m);
  if (!m) return [];
  const after = last.slice((m.index ?? 0) + m[0].length);
  const out: string[] = [];
  for (const line of after.split('\n')) {
    if (/^#{1,4}\s/.test(line)) break;
    const q = line.match(/^\s*(?:\d+[.)]|[-*•])\s+(.+)$/);
    if (q) out.push(q[1].trim());
  }
  return out;
}

export async function pullReplies(fetchFn: typeof fetch = fetch): Promise<number> {
  const cfg = await getCoachConfig();
  if (!cfg) return 0;
  const api = gh(cfg, fetchFn);
  const files = await api.listDir('outbox/replies');
  let n = 0;
  for (const f of files) {
    const id = f.name.replace(/\.md$/, '');
    const s = await db.sync.get(id);
    if (s?.replySha === f.sha) continue;
    const file = await api.getFile(f.path);
    if (!file) continue;
    await db.sync.put({
      ...(s ?? { entryId: id }),
      status: 'read',
      reply: file.text,
      replySha: f.sha,
      replySeen: false,
    });
    n++;
  }
  return n;
}

export async function pullPrep(fetchFn: typeof fetch = fetch): Promise<number> {
  const cfg = await getCoachConfig();
  if (!cfg) return 0;
  const api = gh(cfg, fetchFn);
  const files = (await api.listDir('outbox/prep')).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 10);
  let n = 0;
  for (const f of files) {
    const have = await db.prep.get(f.name);
    if (have?.sha === f.sha) continue;
    const file = await api.getFile(f.path);
    if (file) {
      await db.prep.put({ name: f.name, sha: f.sha, text: file.text });
      n++;
    }
  }
  return n;
}

/** Start time of a prep file named YYYY-MM-DD-HHMM.md. */
export function prepStart(name: string): number | null {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
}

/** Newest prep whose training is today and not over (training assumed to last up to 3 hours). */
export function currentPrep<T extends { name: string }>(preps: T[], now = Date.now()): T | null {
  const today = new Date(now).toDateString();
  const ok = preps
    .map((p) => ({ p, t: prepStart(p.name) }))
    .filter((x) => x.t != null && new Date(x.t).toDateString() === today && x.t + 3 * 3600_000 > now)
    .sort((a, b) => a.t! - b.t!);
  return ok[0]?.p ?? null;
}

export async function syncAll(): Promise<string | undefined> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return undefined;
  const r = await processOutbox();
  try {
    await pullReplies();
    await pullPrep();
  } catch (e) {
    return r.error ?? explainError(e);
  }
  return r.error;
}
