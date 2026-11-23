import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { GymDB, ensureSeed, useDb, db } from '../src/lib/db';
import {
  b64decode, b64encode, bjjText, currentPrep, enqueue, lastQuestions, processOutbox, pullReplies, setCoachConfig,
} from '../src/lib/sync';
import { exportData, importData } from '../src/lib/backup';
import type { BjjSession } from '../src/lib/types';

/** A tiny fake of the GitHub contents API, kept in memory. */
function fakeGitHub() {
  const files = new Map<string, { sha: string; content: string }>();
  let n = 0;
  let fail = false;
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const path = decodeURIComponent(url.split('/contents/')[1] ?? '');
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}`);
    if (fail) throw new TypeError('offline');
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (method === 'GET') {
      const file = files.get(path);
      if (file) return json(200, { sha: file.sha, content: file.content, type: 'file' });
      const kids = [...files.entries()].filter(([p]) => p.startsWith(path + '/'));
      if (kids.length)
        return json(200, kids.map(([p, v]) => ({ name: p.split('/').pop(), path: p, sha: v.sha, type: 'file' })));
      return json(404, { message: 'Not Found' });
    }
    const body = JSON.parse(String(init?.body));
    const existing = files.get(path);
    if (existing && body.sha !== existing.sha) return json(409, { message: 'sha mismatch' });
    files.set(path, { sha: 's' + ++n, content: body.content });
    return json(201, {});
  }) as unknown as typeof fetch;
  return { f, files, calls, setFail: (v: boolean) => (fail = v), text: (p: string) => b64decode(files.get(p)!.content) };
}

const bjj = (id: string, rev = 1): BjjSession => ({
  id, start: new Date(2026, 10, 23, 19).getTime(), type: 'gi', minutes: 90, intensity: 7,
  summary: 'עבדתי על גארד פתוח', rev, updatedAt: Date.now(),
});

beforeEach(async () => {
  const d = new GymDB('test-' + Math.random());
  useDb(d);
  await ensureSeed(d);
  await setCoachConfig({ repo: 'me/gym-data', token: 't' });
});

describe('base64 UTF-8', () => {
  it('round-trips Hebrew', () => {
    expect(b64decode(b64encode('שלום kg ✓'))).toBe('שלום kg ✓');
  });
});

describe('outbox (S-053)', () => {
  it('uploads entries in order and marks them sent', async () => {
    const g = fakeGitHub();
    await db.bjj.put(bjj('a'));
    await db.bjj.put(bjj('b'));
    await enqueue('bjj', 'a', 1);
    await enqueue('bjj', 'b', 1);
    const r = await processOutbox(g.f);
    expect(r.sent).toBe(2);
    const puts = g.calls.filter((c) => c.startsWith('PUT'));
    expect(puts).toEqual(['PUT inbox/bjj/a.json', 'PUT inbox/bjj/b.json']);
    expect((await db.sync.get('a'))?.status).toBe('sent');
    expect(JSON.parse(g.text('inbox/bjj/a.json')).text).toContain('עבדתי על גארד פתוח');
  });

  it('keeps items when offline and sends them later without duplicates', async () => {
    const g = fakeGitHub();
    await db.bjj.put(bjj('a'));
    await enqueue('bjj', 'a', 1);
    g.setFail(true);
    const r1 = await processOutbox(g.f);
    expect(r1.sent).toBe(0);
    expect(r1.error).toBeTruthy();
    expect(await db.outbox.count()).toBe(1);
    g.setFail(false);
    await db.outbox.toCollection().modify({ nextTry: 0 });
    const r2 = await processOutbox(g.f);
    expect(r2.sent).toBe(1);
    expect(await db.outbox.count()).toBe(0);
    expect([...g.files.keys()]).toEqual(['inbox/bjj/a.json']);
  });

  it('an edit uploads the same id again with a higher revision', async () => {
    const g = fakeGitHub();
    await db.bjj.put(bjj('a'));
    await enqueue('bjj', 'a', 1);
    await processOutbox(g.f);
    await db.bjj.put(bjj('a', 2));
    await enqueue('bjj', 'a', 2);
    await processOutbox(g.f);
    expect(JSON.parse(g.text('inbox/bjj/a.json')).rev).toBe(2);
  });

  it('only the newest queued revision is kept', async () => {
    await db.bjj.put(bjj('a', 3));
    await enqueue('bjj', 'a', 1);
    await enqueue('bjj', 'a', 2);
    await enqueue('bjj', 'a', 3);
    expect(await db.outbox.count()).toBe(1);
  });
});

describe('replies (S-055)', () => {
  it('pulls a reply and marks the entry read', async () => {
    const g = fakeGitHub();
    g.files.set('outbox/replies/a.md', { sha: 'r1', content: b64encode('<!-- round 1 -->\nכל הכבוד\n\n## שאלות\n1. עם מי עשית ספארינג?\n2. כמה סבבים?') });
    expect(await pullReplies(g.f)).toBe(1);
    const s = await db.sync.get('a');
    expect(s?.status).toBe('read');
    expect(lastQuestions(s!.reply!)).toEqual(['עם מי עשית ספארינג?', 'כמה סבבים?']);
    expect(await pullReplies(g.f)).toBe(0);
  });
  it('no questions section means no questions', () => {
    expect(lastQuestions('<!-- round 1 -->\nיופי של אימון')).toEqual([]);
    expect(lastQuestions('<!-- round 1 -->\n## שאלות\n1. א?\n<!-- round 2 -->\nתודה')).toEqual([]);
  });
});

describe('prep (S-056)', () => {
  it('shows today’s prep until 3 hours after the start', () => {
    const now = new Date(2026, 10, 23, 18, 30).getTime();
    const preps = [{ name: '2026-11-23-1900.md' }, { name: '2026-11-22-1900.md' }, { name: '2026-11-23-1000.md' }];
    expect(currentPrep(preps, now)?.name).toBe('2026-11-23-1900.md');
    expect(currentPrep(preps, new Date(2026, 10, 23, 22, 30).getTime())).toBeNull();
  });
});

describe('text for the coach', () => {
  it('BJJ text has type, duration, intensity and summary', () => {
    const t = bjjText(bjj('a'));
    expect(t).toContain('גי');
    expect(t).toContain('90 דקות');
    expect(t).toContain('קושי 7/10');
  });
});

describe('backup (S-043)', () => {
  it('export then import gives the same data', async () => {
    await db.bjj.put(bjj('a'));
    await db.bodyweight.put({ date: '2026-11-23', kg: 80 });
    const json = await exportData();
    const d2 = new GymDB('test2-' + Math.random());
    useDb(d2);
    await importData(json);
    expect((await d2.bjj.get('a'))?.summary).toBe('עבדתי על גארד פתוח');
    expect((await d2.bodyweight.get('2026-11-23'))?.kg).toBe(80);
    expect(await d2.exercises.count()).toBeGreaterThanOrEqual(150);
  });
  it('a broken file changes nothing', async () => {
    await db.bjj.put(bjj('a'));
    await expect(importData('{nope')).rejects.toThrow();
    await expect(importData('{"app":"other"}')).rejects.toThrow();
    expect(await db.bjj.count()).toBe(1);
  });
});
