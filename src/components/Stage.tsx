import { useEffect, useRef, useState } from 'react';
import { mainView, viewsFor } from '../data/catalog';
import { createBedroomScene, type BedroomScene } from '../scene/createScene';
import type { Settings } from '../state/settings';
import { DayNightSwitch } from './DayNightSwitch';
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
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);
  const [webgl, setWebgl] = useState(true);

  /* build the three.js scene once; it is torn down on unmount */
  useEffect(() => {
    let scene: BedroomScene;
    try {
      scene = createBedroomScene(canvasRef.current!, wrapRef.current!, settingsRef.current, (room) =>
        updateRef.current({ room: room ?? 'all' }),
      );
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

  /* selecting a room (from the panel or by clicking it) flies the camera to it */
  useEffect(() => {
    sceneRef.current?.setView(mainView(settings.room).pose);
  }, [settings.room]);

  return (
    <div className="stage-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="stage-canvas" aria-label="3D apartment preview. Click a room to select it, drag to orbit, scroll or pinch to zoom." />
      <div className="hint">Click a room to select it · drag to orbit · scroll or pinch to zoom</div>
      <div className="lightbar" role="group" aria-label="Lighting">
        <DayNightSwitch time={settings.time} onChange={(time) => update({ time })} />
      </div>
      <div className="viewbar" role="group" aria-label="Camera views">
        {viewsFor(settings.room).map((v) => (
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
