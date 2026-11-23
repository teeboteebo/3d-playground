import { useEffect, useRef, useState } from 'react';
import { mainView, viewsFor } from '../data/catalog';
import { roomById } from '../data/rooms';
import type { ApartmentScene } from '../scene/createScene';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { DayNightSwitch } from './DayNightSwitch';
import { Icon } from './Icon';
import { optionLabel } from './optionLabel';

interface Props {
  settings: Settings;
  update: Update;
  /** opens a page of the selected room's menu, from a click on one of its options in 3D ([] for its summary) */
  onOption: (path: readonly string[]) => void;
}

export function Stage({ settings, update, onOption }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ApartmentScene | null>(null);
  const settingsRef = useRef(settings);
  /** set when a 3D click changes the room, so that change keeps the camera's rotation and zoom */
  const pickedRef = useRef(false);
  const updateRef = useRef(update);
  const onOptionRef = useRef(onOption);
  useEffect(() => {
    updateRef.current = update;
    onOptionRef.current = onOption;
  }, [update, onOption]);
  /* the label that follows the mouse over an option; moved directly, so hovering never re-renders */
  const labelRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(true);

  /* build the three.js scene once; it is torn down on unmount. three.js is loaded on demand, so the panel can
     show before the 3D code has arrived */
  useEffect(() => {
    let scene: ApartmentScene | null = null;
    let cancelled = false;
    void import('../scene/createScene')
      .then(({ createApartmentScene }) => {
        if (cancelled) return;
        scene = createApartmentScene(
          canvasRef.current!,
          wrapRef.current!,
          settingsRef.current,
          ({ room, option }) => {
            const current = settingsRef.current.room;
            const next = room ?? 'all';
            /* inside the selected room a click opens what it landed on, or the room's summary for anything else */
            if (current !== 'all' && next === current) {
              onOptionRef.current(option?.room === current ? option.path : []);
              return;
            }
            if (next === current) return;
            pickedRef.current = true;
            updateRef.current({ room: next });
          },
          (hover) => {
            const label = labelRef.current;
            if (!label) return;
            label.hidden = !hover;
            if (!hover) return;
            label.textContent = hover.option ? optionLabel(hover.option.path) : roomById(hover.room).name;
            label.style.transform = `translate(${Math.round(hover.x + 14)}px, ${Math.round(hover.y + 16)}px)`;
          },
        );
        sceneRef.current = scene;
        /* the selection's view, which the effect below could not set while the scene was loading */
        scene.setView(mainView(settingsRef.current.room).pose);
      })
      .catch((e: unknown) => {
        console.warn(e);
        if (!cancelled) setWebgl(false);
      });
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    sceneRef.current?.apply(settings);
  }, [settings]);

  /* selecting a room from the panel flies the camera to its view; picking it in 3D only moves the pivot to the
     room, keeping the rotation and zoom the user had */
  useEffect(() => {
    const pose = mainView(settings.room).pose;
    if (pickedRef.current) {
      pickedRef.current = false;
      sceneRef.current?.setView({ tx: pose.tx, ty: pose.ty, tz: pose.tz });
      return;
    }
    sceneRef.current?.setView(pose);
  }, [settings.room]);

  return (
    <div className="stage-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="stage-canvas" aria-label="3D apartment preview. Click a room to select it, then click something in it to change it. Drag to orbit, scroll or pinch to zoom." />
      <div className="hint">
        {settings.room === 'all' ? 'Click a room to select it' : 'Click something to change it'} · drag to orbit · scroll or pinch to zoom
      </div>
      <div ref={labelRef} className="pick-label" aria-hidden="true" hidden />
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
