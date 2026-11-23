import { useEffect } from 'preact/hooks';
import { db } from './lib/db';
import { getLive } from './lib/actions';
import { fmtClock } from './lib/calc';
import { syncAll } from './lib/sync';
import { nav, useLive, useNow, useRoute } from './hooks';
import { Icon } from './components/ui';
import { RestBar } from './components/RestBar';
import { LivePage, WorkoutHome } from './pages/Workout';
import { BjjDetail, EditWorkout, HistoryPage, WorkoutDetail } from './pages/History';
import { BjjForm } from './pages/Bjj';
import { RoutineDetail, RoutineEditor, RoutinesPage } from './pages/Routines';
import { CustomExerciseForm, ExercisePage, ExercisesPage } from './pages/Exercises';
import { BodyWeightPage, ProfilePage } from './pages/Profile';
import { SettingsPage } from './pages/Settings';

function Page(props: { r: string[] }) {
  const [a, b, c] = props.r;
  switch (a) {
    case undefined: return <WorkoutHome />;
    case 'live': return <LivePage />;
    case 'bjj': return b === 'new' ? <BjjForm /> : <BjjForm id={b} />;
    case 'b': return <BjjDetail id={b} />;
    case 'w': return c === 'edit' ? <EditWorkout id={b} /> : <WorkoutDetail id={b} />;
    case 'history': return <HistoryPage />;
    case 'routines':
      if (!b) return <RoutinesPage />;
      if (b === 'new') return <RoutineEditor />;
      return c === 'edit' ? <RoutineEditor id={b} /> : <RoutineDetail id={b} />;
    case 'exercises':
      if (!b) return <ExercisesPage />;
      return b === 'new' ? <CustomExerciseForm /> : <ExercisePage id={b} />;
    case 'profile': return b === 'bodyweight' ? <BodyWeightPage /> : <ProfilePage />;
    case 'settings': return <SettingsPage />;
    default: return <WorkoutHome />;
  }
}

const TABS = [
  { key: '', label: 'אימון', icon: 'workout', match: ['', 'live', 'bjj'] },
  { key: 'routines', label: 'רוטינות', icon: 'routines', match: ['routines'] },
  { key: 'exercises', label: 'תרגילים', icon: 'exercises', match: ['exercises'] },
  { key: 'history', label: 'היסטוריה', icon: 'history', match: ['history', 'w', 'b'] },
  { key: 'profile', label: 'פרופיל', icon: 'profile', match: ['profile', 'settings'] },
] as const;

function LiveBar() {
  const live = useLive(getLive, []);
  const now = useNow(1000);
  if (!live) return null;
  return (
    <button class="livebar" onClick={() => nav('live')}>
      <span>אימון פעיל · חזור</span>
      <span class="ltr">{fmtClock((now - live.start) / 1000)}</span>
    </button>
  );
}

export function App() {
  const r = useRoute();
  const unseen = useLive(() => db.sync.filter((s) => s.replySeen === false).count(), []) ?? 0;
  const top = r[0] ?? '';

  useEffect(() => {
    const run = () => { if (document.visibilityState === 'visible') void syncAll(); };
    run();
    const t = setInterval(run, 60_000);
    addEventListener('online', run);
    document.addEventListener('visibilitychange', run);
    return () => { clearInterval(t); removeEventListener('online', run); document.removeEventListener('visibilitychange', run); };
  }, []);

  return (
    <>
      <Page r={r} />
      {top !== 'live' && <LiveBar />}
      {top === 'live' && <RestBar />}
      <nav class="tabbar">
        {TABS.map((t) => (
          <button class={(t.match as readonly string[]).includes(top) ? 'on' : ''} onClick={() => nav(t.key)}>
            <Icon name={t.icon} />
            {t.label}
            {t.key === 'history' && unseen > 0 && <span class="dot" />}
          </button>
        ))}
      </nav>
    </>
  );
}
