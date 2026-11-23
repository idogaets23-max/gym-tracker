import { useEffect, useState } from 'preact/hooks';
import { db } from '../lib/db';
import { sendAnswer, } from '../lib/actions';
import { getCoachConfig, lastQuestions, replyRounds } from '../lib/sync';
import type { EntrySync } from '../lib/types';
import { useLive } from '../hooks';

export function SyncChip(props: { s?: EntrySync; connected: boolean }) {
  if (!props.connected) return null;
  const st = props.s?.status ?? 'waiting';
  const map = { waiting: ['ממתין לשליחה', ''], sent: ['נשלח למאמן', 'blue'], read: ['המאמן ענה', 'green'] } as const;
  return (
    <span class={'chip ' + map[st][1]}>
      {map[st][0]}
      {props.s?.reply && props.s.replySeen === false && <span class="dot" />}
    </span>
  );
}

export function useConnected(): boolean {
  return useLive(async () => !!(await getCoachConfig()), []) ?? false;
}

export function CoachSection(props: { entryId: string }) {
  const s = useLive(() => db.sync.get(props.entryId), [props.entryId]);
  const pending = useLive(() => db.outbox.where('entryId').equals(props.entryId).filter((o) => o.kind === 'answer').toArray(), [props.entryId]) ?? [];
  const connected = useConnected();
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    if (s?.reply && s.replySeen === false) void db.sync.update(props.entryId, { replySeen: true });
  }, [s?.replySha]);

  if (!connected) {
    return (
      <div class="card" style="margin-top:14px">
        <b>מאמן</b>
        <p class="muted small">החיבור למאמן לא מוגדר. הגדרות ← חיבור למאמן.</p>
      </div>
    );
  }
  const rounds = s?.reply ? replyRounds(s.reply) : [];
  const questions = s?.reply ? lastQuestions(s.reply) : [];
  const answered = (s?.answersSent ?? 0) + pending.length >= rounds.length && questions.length > 0;

  return (
    <div class="card" style="margin-top:14px">
      <div class="row between">
        <b>🥋 המאמן</b>
        <SyncChip s={s} connected />
      </div>
      {!s?.reply && <p class="muted small">{s?.status === 'sent' ? 'נשלח. התשובה תופיע כאן כשהמחשב יעבד אותה.' : 'יישלח כשיהיה חיבור.'}</p>}
      {rounds.map((r, i) => (
        <div>
          {i > 0 && <hr />}
          <div class="reply summary-text">{r}</div>
        </div>
      ))}
      {pending.map((p) => (
        <div class="note">התשובה שלך (ממתינה): {p.text}</div>
      ))}
      {questions.length > 0 && !answered && (
        <div style="margin-top:10px">
          <textarea rows={4} dir="auto" placeholder="התשובות שלך לשאלות של המאמן" value={answer}
            onInput={(e) => setAnswer((e.target as HTMLTextAreaElement).value)} />
          <button class="btn primary block" style="margin-top:8px" disabled={!answer.trim()}
            onClick={async () => { await sendAnswer(props.entryId, answer.trim()); setAnswer(''); }}>
            שלח תשובות למאמן
          </button>
        </div>
      )}
    </div>
  );
}
