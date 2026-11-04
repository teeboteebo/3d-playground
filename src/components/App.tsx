import { useSettings } from '../state/useSettings';
import { Panel } from './Panel';
import { Stage } from './Stage';

export function App() {
  const [settings, update] = useSettings();
  return (
    <div className="app">
      <Stage settings={settings} update={update} />
      <Panel settings={settings} update={update} />
    </div>
  );
}
