import { useEffect, useRef } from 'preact/hooks';
import { db } from '../lib/db';
import { fmtClock } from '../lib/calc';
import { useLive, useNow, useSettings } from '../hooks';

interface Rest { end: number; total: number }

function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.2;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch { /* no audio */ }
}

/** Countdown at the bottom. Computed from the end time, so it stays right in the background. */
export function RestBar() {
  const rest = useLive(async () => (await db.kv.get('rest'))?.value as Rest | undefined, []);
  const now = useNow(250);
  const settings = useSettings();
  const fired = useRef<number | null>(null);
  const left = rest ? (rest.end - now) / 1000 : 0;

  useEffect(() => {
    if (!rest || left > 0 || fired.current === rest.end) return;
    fired.current = rest.end;
    if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
    if (settings.sound) beep();
    void db.kv.delete('rest');
  }, [rest?.end, left <= 0]);

  if (!rest || left <= 0) return null;
  const set = (end: number, total: number) => db.kv.put({ key: 'rest', value: { end, total } });
  return (
    <div class="restbar">
      <button class="btn small" onClick={() => set(rest.end - 15000, rest.total)}>-15</button>
      <div class="grow">
        <div class="time">{fmtClock(Math.ceil(left))}</div>
        <div class="progress"><div style={`width:${Math.max(0, (left / rest.total) * 100)}%`} /></div>
      </div>
      <button class="btn small" onClick={() => set(rest.end + 15000, rest.total + 15)}>+15</button>
      <button class="btn small primary" onClick={() => db.kv.delete('rest')}>דלג</button>
    </div>
  );
}
