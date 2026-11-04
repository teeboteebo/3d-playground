import { useEffect, useRef, useState } from 'react';
import { VIEWS } from '../data/catalog';
import { createBedroomScene, type BedroomScene } from '../scene/createScene';
import type { Settings } from '../state/settings';
import { Icon } from './Icon';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function Stage({ settings, update }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BedroomScene | null>(null);
  const settingsRef = useRef(settings);
  const [webgl, setWebgl] = useState(true);

  /* build the three.js scene once; it is torn down on unmount */
  useEffect(() => {
    let scene: BedroomScene;
    try {
      scene = createBedroomScene(canvasRef.current!, wrapRef.current!, settingsRef.current);
    } catch (e) {
      console.warn(e);
      setWebgl(false); // eslint-disable-line react-hooks/set-state-in-effect -- one-off capability probe
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    sceneRef.current?.apply(settings);
  }, [settings]);

  const pendantOn = settings.pendant === 'on';

  return (
    <div className="stage-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="stage-canvas" aria-label="3D bedroom preview. Drag to orbit, scroll or pinch to zoom." />
      <div className="hint">Drag to orbit · scroll or pinch to zoom</div>
      <div className="lightbar" role="group" aria-label="Lighting">
        <button type="button" aria-pressed={settings.time === 'day'} onClick={() => update({ time: 'day' })}>
          <Icon name="sun" />
          <span>Daylight</span>
        </button>
        <button type="button" aria-pressed={settings.time === 'eve'} onClick={() => update({ time: 'eve' })}>
          <Icon name="moon" />
          <span>Evening lamp</span>
        </button>
        <button type="button" aria-pressed={pendantOn} onClick={() => update({ pendant: pendantOn ? 'off' : 'on' })}>
          <Icon name="pendant" />
          <span>Pendant {pendantOn ? 'on' : 'off'}</span>
        </button>
      </div>
      <div className="viewbar" role="group" aria-label="Camera views">
        {VIEWS.map((v) => (
          <button key={v.name} type="button" onClick={() => sceneRef.current?.setView(v.pose)}>
            <Icon name={v.icon} />
            <span>{v.name}</span>
          </button>
        ))}
      </div>
      <div className={webgl ? 'nowebgl' : 'nowebgl show'} role={webgl ? undefined : 'alert'}>
        This preview needs WebGL, which is not available in this browser.
      </div>
    </div>
  );
}
