import type { ComponentChildren } from 'preact';
import { back } from '../hooks';

export function Sheet(props: { onClose: () => void; title?: string; full?: boolean; children: ComponentChildren }) {
  return (
    <div class="backdrop" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class={'sheet' + (props.full ? ' full' : '')} role="dialog">
        {props.title && (
          <div class="row between">
            <h3>{props.title}</h3>
            <button class="icon-btn" aria-label="סגור" onClick={props.onClose}>✕</button>
          </div>
        )}
        {props.children}
      </div>
    </div>
  );
}

export function Confirm(props: {
  title: string; text?: string; yes: string; no: string; danger?: boolean;
  onYes: () => void; onNo: () => void;
}) {
  return (
    <Sheet onClose={props.onNo}>
      <h3>{props.title}</h3>
      {props.text && <p class="muted">{props.text}</p>}
      <div class="stack">
        <button class={'btn block ' + (props.danger ? 'danger' : 'primary')} style={props.danger ? 'background:var(--card);border:1px solid var(--line)' : ''} onClick={props.onYes}>{props.yes}</button>
        <button class="btn block" onClick={props.onNo}>{props.no}</button>
      </div>
    </Sheet>
  );
}

export function Menu(props: { onClose: () => void; items: { label: string; icon?: string; danger?: boolean; onClick: () => void }[] }) {
  return (
    <Sheet onClose={props.onClose}>
      <div class="menu">
        {props.items.map((it) => (
          <button style={it.danger ? 'color:var(--red)' : ''} onClick={() => { props.onClose(); it.onClick(); }}>
            {it.icon && <span>{it.icon}</span>}
            {it.label}
          </button>
        ))}
      </div>
      <button class="btn block" style="margin-top:10px" onClick={props.onClose}>ביטול</button>
    </Sheet>
  );
}

export function Seg<T extends string | number>(props: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div class="seg">
      {props.options.map(([v, l]) => (
        <button class={v === props.value ? 'on' : ''} onClick={() => props.onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function TopBar(props: { title: string; backTo?: string | true; right?: ComponentChildren }) {
  return (
    <div class="topbar">
      {props.backTo && (
        <button class="icon-btn" aria-label="חזרה" onClick={() => back(typeof props.backTo === 'string' ? props.backTo : '')}>→</button>
      )}
      <h1>{props.title}</h1>
      {props.right}
    </div>
  );
}

export function Empty(props: { icon: string; text: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="big">{props.icon}</div>
      <p>{props.text}</p>
      {props.children}
    </div>
  );
}

const I = {
  workout: 'M6 9v6M18 9v6M3 10.5v3M21 10.5v3M6 12h12',
  routines: 'M5 5h14v4H5zM5 11h14v4H5zM5 17h9',
  exercises: 'M4 6h16M4 12h16M4 18h10',
  history: 'M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
};
export function Icon(props: { name: keyof typeof I }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d={I[props.name]} />
    </svg>
  );
}
