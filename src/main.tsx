import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { ensureSeed } from './lib/db';
import './styles.css';

declare global {
  const __BUILD__: string;
}

registerSW({ immediate: true });

void ensureSeed().then(() => {
  // ask the browser to keep our data (iOS may still clear it if the app is unused for weeks)
  void navigator.storage?.persist?.();
  render(<App />, document.getElementById('app')!);
});
