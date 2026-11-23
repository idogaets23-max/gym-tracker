// Real GitHub round trip with the app's own sync code. Runs only when these are set:
//   GYM_LIVE=1 GYM_DATA_REPO=owner/name GYM_ENV_FILE=<path to .env with GYM_GITHUB_TOKEN> npx vitest run tests/live-github.test.ts
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GymDB, ensureSeed, useDb, db } from '../src/lib/db';
import { enqueue, gh, processOutbox, pullPrep, pullReplies, setCoachConfig } from '../src/lib/sync';

const live = process.env.GYM_LIVE === '1';

describe.skipIf(!live)('live GitHub round trip', () => {
  it('uploads an entry, reads a reply and a prep, then cleans up', async () => {
    const env = fs.readFileSync(process.env.GYM_ENV_FILE!, 'utf8');
    const token = env.match(/^\s*GYM_GITHUB_TOKEN\s*=\s*(.+)$/m)![1].trim();
    const cfg = { repo: process.env.GYM_DATA_REPO!, token };
    useDb(new GymDB('live-' + Date.now()));
    await ensureSeed();
    await setCoachConfig(cfg);
    const id = 'livetest-' + Date.now();
    await db.bjj.put({ id, start: Date.now(), type: 'gi', minutes: 60, intensity: 5, summary: 'בדיקה אוטומטית, למחוק', rev: 1, updatedAt: Date.now() });
    await enqueue('bjj', id, 1);
    const r = await processOutbox();
    expect(r.error).toBeUndefined();
    expect(r.sent).toBe(1);

    const api = gh(cfg);
    const up = await api.getFile(`inbox/bjj/${id}.json`);
    expect(JSON.parse(up!.text).text).toContain('בדיקה אוטומטית');

    await api.putFile(`outbox/replies/${id}.md`, '<!-- round 1 -->\nתשובת בדיקה\n\n## שאלות\n1. שאלה?', 'live test reply');
    const prepName = `2000-01-01-0000-${id}.md`;
    await api.putFile(`outbox/prep/${prepName}`, 'הכנה לבדיקה', 'live test prep');
    expect(await pullReplies()).toBeGreaterThanOrEqual(1);
    expect((await db.sync.get(id))?.status).toBe('read');
    await pullPrep();

    // clean up
    const del = async (p: string) => {
      const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${p}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${p}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'remove live test', sha: j.sha }),
      });
    };
    await del(`inbox/bjj/${id}.json`);
    await del(`outbox/replies/${id}.md`);
    await del(`outbox/prep/${prepName}`);
  }, 60_000);
});
