import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from '../engine/core/Engine';
import { DemoScene } from '../engine/demo/DemoScene';
import { DEFAULT_POST_FX } from '../engine/rendering/PostProcessStack';
import { LogLevel } from '../engine/core/Logger';
import { Logger } from '../engine/core/Logger';

// Silence debug noise in production
Logger.globalLevel = LogLevel.WARN;

interface Stats {
  fps:       number;
  frameTime: number;
  drawCalls: number;
  entities:  number;
}

interface PostFX {
  vignetteStrength:    number;
  bloomIntensity:      number;
  chromaticAberration: number;
  scanlineIntensity:   number;
  saturation:          number;
  contrast:            number;
  brightness:          number;
}

export default function MidnightEnginePage() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const engineRef  = useRef<Engine | null>(null);
  const [stats, setStats]   = useState<Stats>({ fps: 0, frameTime: 0, drawCalls: 0, entities: 0 });
  const [postFX, setPostFX] = useState<PostFX>({ ...DEFAULT_POST_FX });
  const [running, setRunning] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Boot engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || engineRef.current) return;

    const engine = new Engine({
      canvas,
      width:  canvas.parentElement?.clientWidth  ?? 800,
      height: canvas.parentElement?.clientHeight ?? 500,
      debug: true,
    });

    const demo = new DemoScene(engine.input);
    engine.scenes.register(demo);

    engine.events.on<number>('render', () => {
      const scene = engine.scenes.current;
      setStats({
        fps:       engine.stats.fps,
        frameTime: +(engine.stats.frameTime * 1000).toFixed(2),
        drawCalls: engine.stats.drawCalls,
        entities:  scene?.world.getAllEntities().length ?? 0,
      });
    });

    engine.goto('Demo').then(() => {
      engine.start();
      setRunning(true);
    });

    engineRef.current = engine;

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  // Sync post-FX sliders to renderer
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    Object.assign(engine.renderer.postFX, postFX);
  }, [postFX]);

  const handleUnlockAudio = useCallback(async () => {
    await engineRef.current?.unlockAudio();
    setAudioUnlocked(true);
  }, []);

  const handleToggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.running) { engine.stop(); setRunning(false); }
    else                { engine.start(); setRunning(true); }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      {/* Header */}
      <header className="border-b border-[#1a1a2e] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#c084fc]">Midnight Engine</h1>
          <p className="text-xs text-gray-500 mt-0.5">v0.1.0 · WebGL2 · ECS · TypeScript</p>
        </div>
        <div className="flex gap-3">
          {!audioUnlocked && (
            <button
              onClick={handleUnlockAudio}
              className="px-3 py-1.5 text-xs rounded bg-[#1e1e3a] border border-[#3b3b6b] hover:bg-[#2a2a50] transition-colors"
            >
              Unlock Audio
            </button>
          )}
          <button
            onClick={handleToggle}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              running
                ? 'bg-[#2d1a1a] border-[#6b2b2b] hover:bg-[#3d2020] text-red-400'
                : 'bg-[#1a2d1a] border-[#2b6b2b] hover:bg-[#203d20] text-green-400'
            }`}
          >
            {running ? '⏸ Pause' : '▶ Resume'}
          </button>
        </div>
      </header>

      <div className="flex gap-0 h-[calc(100vh-64px)]">
        {/* Canvas */}
        <div className="flex-1 relative bg-black overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ imageRendering: 'pixelated', display: 'block' }}
          />

          {/* HUD overlay */}
          <div className="absolute top-3 left-3 bg-black/60 rounded px-3 py-2 text-xs space-y-0.5 pointer-events-none">
            <div className="text-[#c084fc] font-bold mb-1">STATS</div>
            <div>FPS: <span className={stats.fps >= 50 ? 'text-green-400' : 'text-red-400'}>{stats.fps}</span></div>
            <div>Frame: <span className="text-yellow-300">{stats.frameTime}ms</span></div>
            <div>Draw calls: <span className="text-blue-300">{stats.drawCalls}</span></div>
            <div>Entities: <span className="text-purple-300">{stats.entities}</span></div>
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-3 left-3 bg-black/60 rounded px-3 py-2 text-xs text-gray-400 pointer-events-none space-y-0.5">
            <div className="text-gray-300 font-bold mb-1">CONTROLS</div>
            <div>WASD / Arrows — Move player</div>
            <div>Space — Jump</div>
            <div>Z / Left Click — Attack</div>
            <div>Gamepad supported</div>
          </div>
        </div>

        {/* Side panel — Post-FX controls */}
        <div className="w-72 bg-[#0d0d18] border-l border-[#1a1a2e] overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-bold text-[#c084fc] mb-4 uppercase tracking-wider">Post-FX Pipeline</h2>

            {(Object.keys(postFX) as (keyof PostFX)[]).map((key) => {
              const ranges: Record<keyof PostFX, [number, number, number]> = {
                vignetteStrength:    [0, 2,   0.01],
                bloomIntensity:      [0, 3,   0.01],
                chromaticAberration: [0, 0.02, 0.001],
                scanlineIntensity:   [0, 1,   0.01],
                saturation:          [0, 2,   0.01],
                contrast:            [0.5, 2, 0.01],
                brightness:          [-0.5, 0.5, 0.01],
              };
              const [min, max, step] = ranges[key];
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
              return (
                <div key={key} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-[#c084fc]">{postFX[key].toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min={min} max={max} step={step}
                    value={postFX[key]}
                    onChange={(e) => setPostFX(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                    className="w-full accent-[#c084fc]"
                  />
                </div>
              );
            })}

            <button
              onClick={() => setPostFX({ ...DEFAULT_POST_FX })}
              className="mt-2 w-full py-1.5 text-xs rounded bg-[#1e1e3a] border border-[#3b3b6b] hover:bg-[#2a2a50] transition-colors text-gray-300"
            >
              Reset Defaults
            </button>
          </div>

          {/* Engine architecture info */}
          <div className="p-4 border-t border-[#1a1a2e]">
            <h2 className="text-sm font-bold text-[#c084fc] mb-3 uppercase tracking-wider">Systems Active</h2>
            <div className="space-y-1 text-xs">
              {[
                { name: 'PhysicsSystem',   color: '#60a5fa', note: 'Spatial hash · SAT/AABB · Impulse' },
                { name: 'AnimationSystem', color: '#4ade80', note: 'State machine · Blend tree' },
                { name: 'CombatSystem',    color: '#f87171', note: 'Hit detection · Status FX' },
                { name: 'ScriptSystem',    color: '#facc15', note: 'Lifecycle hooks · Action map' },
                { name: 'AudioSystem',     color: '#a78bfa', note: '3D HRTF · Web Audio API' },
                { name: 'RenderSystem',    color: '#fb923c', note: 'Instanced · Post-FX · Camera' },
              ].map(s => (
                <div key={s.name} className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: s.color }} />
                  <div>
                    <div style={{ color: s.color }}>{s.name}</div>
                    <div className="text-gray-600">{s.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture legend */}
          <div className="p-4 border-t border-[#1a1a2e]">
            <h2 className="text-sm font-bold text-[#c084fc] mb-3 uppercase tracking-wider">Architecture</h2>
            <pre className="text-[10px] text-gray-500 leading-4">{`
Engine
 ├─ GameLoop (fixed 60Hz)
 ├─ Renderer (WebGL2)
 │   ├─ SpriteBatch (instanced)
 │   └─ PostProcessStack
 ├─ SceneManager
 ├─ InputManager
 │   ├─ Keyboard
 │   ├─ Mouse
 │   └─ Gamepad (API)
 └─ AudioEngine
     └─ 3D Spatial HRTF

World (ECS)
 ├─ Entity[]
 ├─ Component[]
 └─ System[]
    ├─ PhysicsSystem
    │   ├─ BroadPhase (hash)
    │   ├─ NarrowPhase (SAT)
    │   └─ Resolver
    ├─ AnimationSystem
    │   ├─ StateMachine
    │   └─ BlendTree1D
    ├─ CombatSystem
    ├─ ScriptSystem
    └─ AudioSystem
`.trim()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
