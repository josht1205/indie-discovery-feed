import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine }         from '../engine/core/Engine';
import { DemoScene }      from '../engine/demo/DemoScene';
import { DEFAULT_POST_FX } from '../engine/rendering/PostProcessStack';
import { DEFAULT_LIGHTING } from '../engine/rendering/LightingSystem';
import { Logger, LogLevel } from '../engine/core/Logger';
import { globalDebug }    from '../engine/rendering/DebugDraw';

Logger.globalLevel = LogLevel.WARN;

// Try to import Tauri API — gracefully falls back in browser
let tauriWindow: { setTitle: (t: string) => void } | null = null;
let tauriGetInfo: (() => Promise<Record<string, string>>) | null = null;
try {
  // Dynamic import so it doesn't crash in browser builds
  import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
    tauriWindow = { setTitle: (t) => getCurrentWindow().setTitle(t) };
  }).catch(() => {});
  import('@tauri-apps/api/core').then(({ invoke }) => {
    tauriGetInfo = () => invoke('get_system_info');
  }).catch(() => {});
} catch { /* running in browser */ }

interface Stats {
  fps:       number;
  frameTime: number;
  drawCalls: number;
  entities:  number;
  cullRate:  number;
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

interface LightFX {
  ambientR: number;
  ambientG: number;
  ambientB: number;
}

const POST_RANGES: Record<keyof PostFX, [number, number, number]> = {
  vignetteStrength:    [0,    2,    0.01],
  bloomIntensity:      [0,    3,    0.01],
  chromaticAberration: [0,    0.02, 0.001],
  scanlineIntensity:   [0,    1,    0.01],
  saturation:          [0,    2,    0.01],
  contrast:            [0.5,  2,    0.01],
  brightness:          [-0.5, 0.5,  0.01],
};

export default function MidnightEnginePage() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const engineRef  = useRef<Engine | null>(null);

  const [stats,    setStats]    = useState<Stats>({ fps:0, frameTime:0, drawCalls:0, entities:0, cullRate:0 });
  const [postFX,   setPostFX]   = useState<PostFX>({ ...DEFAULT_POST_FX });
  const [lightFX,  setLightFX]  = useState<LightFX>({ ambientR:0.06, ambientG:0.06, ambientB:0.14 });
  const [running,  setRunning]  = useState(false);
  const [debug,    setDebug]    = useState(false);
  const [isTauri,  setIsTauri]  = useState(false);
  const [sysInfo,  setSysInfo]  = useState<Record<string,string>>({});
  const [activeTab, setTab]     = useState<'postfx'|'lighting'|'systems'|'arch'>('postfx');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || engineRef.current) return;

    const w = canvas.parentElement?.clientWidth  ?? 800;
    const h = canvas.parentElement?.clientHeight ?? 500;

    const engine = new Engine({ canvas, width: w, height: h, debug: true });
    const demo   = new DemoScene(engine.input);
    engine.scenes.register(demo);

    engine.events.on('render', () => {
      const scene = engine.scenes.current;
      setStats({
        fps:       engine.stats.fps,
        frameTime: +(engine.stats.frameTime * 1000).toFixed(2),
        drawCalls: engine.stats.drawCalls,
        entities:  scene?.world.getAllEntities().length ?? 0,
        cullRate:  0, // updated inside demo render
      });
    });

    engine.goto('Demo').then(() => { engine.start(); setRunning(true); });
    engineRef.current = engine;

    // Check if running in Tauri
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      setIsTauri(true);
      tauriWindow?.setTitle('Midnight Engine — Demo Scene');
      tauriGetInfo?.().then(setSysInfo).catch(() => {});
    }

    return () => { engine.stop(); engineRef.current = null; };
  }, []);

  // Sync PostFX
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    Object.assign(engine.renderer.postFX, postFX);
  }, [postFX]);

  const handleToggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.running) { engine.stop(); setRunning(false); }
    else                { engine.start(); setRunning(true); }
  }, []);

  const handleAudio = useCallback(async () => {
    await engineRef.current?.unlockAudio();
  }, []);

  const toggleDebug = useCallback(() => {
    globalDebug.config.enabled = !globalDebug.config.enabled;
    setDebug(globalDebug.config.enabled);
  }, []);

  const handleFullscreen = useCallback(async () => {
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('toggle_fullscreen');
    } else {
      const canvas = canvasRef.current?.parentElement;
      if (canvas?.requestFullscreen) canvas.requestFullscreen();
    }
  }, [isTauri]);

  return (
    <div className="min-h-screen bg-[#08080f] text-white font-mono flex flex-col">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-[#1a1a2e] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#c084fc] animate-pulse" />
          <div>
            <span className="text-[#c084fc] font-bold text-base">Midnight Engine</span>
            <span className="text-gray-600 text-xs ml-2">v0.2.0</span>
          </div>
          {isTauri && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e1e3a] border border-[#3b3b6b] text-[#a78bfa]">
              DESKTOP · {sysInfo.platform ?? '…'}
            </span>
          )}
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={handleAudio}
            className="px-2.5 py-1 rounded bg-[#1a1a2e] border border-[#2a2a4e] hover:bg-[#222240] transition-colors text-gray-400">
            🔊 Audio
          </button>
          <button onClick={toggleDebug}
            className={`px-2.5 py-1 rounded border transition-colors ${debug ? 'bg-[#1e2d1e] border-[#2b5b2b] text-green-400' : 'bg-[#1a1a2e] border-[#2a2a4e] text-gray-400'}`}>
            {debug ? '🐛 Debug ON' : '🐛 Debug'}
          </button>
          <button onClick={handleFullscreen}
            className="px-2.5 py-1 rounded bg-[#1a1a2e] border border-[#2a2a4e] hover:bg-[#222240] transition-colors text-gray-400">
            ⛶ Fullscreen
          </button>
          <button onClick={handleToggle}
            className={`px-2.5 py-1 rounded border transition-colors ${running
              ? 'bg-[#2d1a1a] border-[#6b2b2b] text-red-400'
              : 'bg-[#1a2d1a] border-[#2b6b2b] text-green-400'}`}>
            {running ? '⏸ Pause' : '▶ Resume'}
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 min-h-0">

        {/* Canvas viewport */}
        <div className="flex-1 relative bg-black">
          <canvas ref={canvasRef} className="w-full h-full block" style={{ imageRendering: 'pixelated' }} />

          {/* Stats HUD */}
          <div className="absolute top-2 left-2 bg-black/70 rounded px-2.5 py-1.5 text-[11px] space-y-0.5 pointer-events-none backdrop-blur">
            <div className="text-[#c084fc] font-bold mb-1 text-xs">PERF</div>
            <div>FPS <span className={stats.fps>=55?'text-green-400':stats.fps>=30?'text-yellow-400':'text-red-400'}>{stats.fps}</span></div>
            <div>Frame <span className="text-yellow-300">{stats.frameTime}ms</span></div>
            <div>Draw calls <span className="text-blue-300">{stats.drawCalls}</span></div>
            <div>Entities <span className="text-purple-300">{stats.entities}</span></div>
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur rounded px-2.5 py-1.5 text-[11px] text-gray-500 pointer-events-none space-y-0.5">
            <div className="text-gray-400 font-bold mb-1">CONTROLS</div>
            <div>WASD / Arrows — Move</div>
            <div>Space — Jump</div>
            <div>F3 — Toggle debug overlay</div>
            <div>Gamepad supported</div>
          </div>

          {/* Feature badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none">
            {[
              { label: 'Frustum Culling', color: '#4ade80' },
              { label: 'GPU Particles',   color: '#fb923c' },
              { label: '2D Lighting',     color: '#fbbf24' },
              { label: 'CCD Physics',     color: '#60a5fa' },
              { label: 'Tilemap',         color: '#a78bfa' },
              { label: 'Object Pools',    color: '#f472b6' },
            ].map(b => (
              <div key={b.label} className="text-[10px] px-2 py-0.5 rounded bg-black/60 border"
                style={{ borderColor: b.color + '60', color: b.color }}>
                ✓ {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-72 shrink-0 bg-[#0c0c18] border-l border-[#1a1a2e] flex flex-col">

          {/* Tab bar */}
          <div className="flex border-b border-[#1a1a2e] text-[11px]">
            {(['postfx','lighting','systems','arch'] as const).map(tab => (
              <button key={tab}
                onClick={() => setTab(tab)}
                className={`flex-1 py-2 uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? 'text-[#c084fc] border-b-2 border-[#c084fc]'
                    : 'text-gray-600 hover:text-gray-400'
                }`}>
                {tab === 'postfx' ? 'Post-FX' : tab === 'lighting' ? 'Lights' : tab === 'systems' ? 'Systems' : 'Arch'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">

            {/* PostFX tab */}
            {activeTab === 'postfx' && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-[#c084fc] uppercase tracking-wider mb-3">Post-Process Stack</h2>
                {(Object.keys(postFX) as (keyof PostFX)[]).map((key) => {
                  const [min, max, step] = POST_RANGES[key];
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-[#c084fc]">{postFX[key].toFixed(3)}</span>
                      </div>
                      <input type="range" min={min} max={max} step={step} value={postFX[key]}
                        onChange={(e) => setPostFX(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                        className="w-full accent-[#c084fc] h-1" />
                    </div>
                  );
                })}
                <button onClick={() => setPostFX({ ...DEFAULT_POST_FX })}
                  className="mt-2 w-full py-1 text-[11px] rounded bg-[#1e1e3a] border border-[#3b3b6b] hover:bg-[#2a2a50] text-gray-400">
                  Reset
                </button>
              </div>
            )}

            {/* Lighting tab */}
            {activeTab === 'lighting' && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-[#c084fc] uppercase tracking-wider mb-3">2D Deferred Lighting</h2>
                <p className="text-[10px] text-gray-600 mb-3">
                  UE5 Lumen-inspired deferred light accumulation with point lights, normal map support, and flicker.
                </p>
                {(['ambientR','ambientG','ambientB'] as const).map((key) => {
                  const label = key === 'ambientR' ? 'Ambient Red' : key === 'ambientG' ? 'Ambient Green' : 'Ambient Blue';
                  const col   = key === 'ambientR' ? '#f87171' : key === 'ambientG' ? '#4ade80' : '#60a5fa';
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-gray-500">{label}</span>
                        <span style={{ color: col }}>{lightFX[key].toFixed(3)}</span>
                      </div>
                      <input type="range" min={0} max={0.5} step={0.005} value={lightFX[key]}
                        onChange={(e) => setLightFX(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                        className="w-full h-1" style={{ accentColor: col }} />
                    </div>
                  );
                })}
                <div className="mt-4 text-[10px] text-gray-600 space-y-1 border-t border-[#1a1a2e] pt-3">
                  <div className="text-gray-400 font-bold mb-2">Active Lights</div>
                  <div>🔴 Player Torch — dynamic follow + flicker</div>
                  <div>🟠 Fire Emitter — orange point + additive particles</div>
                  <div>🔵 Spark Emitter — blue/white additive sparks</div>
                  <div>🟣 Orbiting Moon — purple fill light</div>
                  <div>⬜ Global Ambient — scene fill</div>
                </div>
              </div>
            )}

            {/* Systems tab */}
            {activeTab === 'systems' && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold text-[#c084fc] uppercase tracking-wider mb-3">Active Systems</h2>
                {[
                  { name:'RenderSystem',      color:'#fb923c', note:'Frustum cull · cmd buffer · decoupled (Godot)' },
                  { name:'PhysicsSystem',     color:'#60a5fa', note:'SpatialHash · SAT · Impulse · CCD (UE5 Chaos)' },
                  { name:'ParticleEmitter',   color:'#f87171', note:'GPU instanced · Niagara-inspired (UE5)' },
                  { name:'LightingSystem',    color:'#fbbf24', note:'Deferred 2D · Normal maps (UE5 Lumen)' },
                  { name:'AnimationSystem',   color:'#4ade80', note:'StateMachine · BlendTree1D' },
                  { name:'CombatSystem',      color:'#f472b6', note:'Hit detection · Combos · Status FX' },
                  { name:'ScriptSystem',      color:'#facc15', note:'Lifecycle hooks · Action map' },
                  { name:'AudioSystem',       color:'#a78bfa', note:'3D HRTF · Web Audio · Reverb' },
                  { name:'VisibilityNotifier',color:'#67e8f9', note:'Enter/exit viewport events (Godot)' },
                ].map(s => (
                  <div key={s.name} className="flex items-start gap-2 py-1.5 border-b border-[#111122]">
                    <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: s.color }} />
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: s.color }}>{s.name}</div>
                      <div className="text-[10px] text-gray-600">{s.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Architecture tab */}
            {activeTab === 'arch' && (
              <div>
                <h2 className="text-xs font-bold text-[#c084fc] uppercase tracking-wider mb-3">Architecture</h2>
                <pre className="text-[9px] text-gray-500 leading-[1.5] whitespace-pre-wrap">{`
Midnight Engine v0.2.0
━━━━━━━━━━━━━━━━━━━━━━

Engine (Orchestrator)
 ├─ GameLoop
 │   ├─ Fixed 60Hz (physics/logic)
 │   └─ Variable render + alpha
 ├─ Renderer (WebGL2)
 │   ├─ SpriteBatch (instanced)
 │   ├─ PostProcessStack
 │   │   ├─ Bloom
 │   │   ├─ Vignette
 │   │   ├─ Chromatic Aberration
 │   │   ├─ CRT Scanlines
 │   │   └─ Saturation/Contrast
 │   └─ RenderCommandBuffer
 │       └─ Frustum Culling
 ├─ SceneManager (fade transitions)
 ├─ InputManager
 │   ├─ Keyboard (frame-buffered)
 │   ├─ Mouse
 │   └─ Gamepad (API + deadzone)
 └─ AudioEngine (Web Audio API)
     ├─ 3D HRTF Spatial Audio
     ├─ Gain bus (master/sfx/music)
     └─ Convolution Reverb

World (ECS)
 ├─ Entity (typed components)
 ├─ GroupManager (Godot groups)
 ├─ Tags (lightweight markers)
 └─ Systems[]
     ├─ PhysicsSystem
     │   ├─ SpatialHash BroadPhase
     │   ├─ NarrowPhase
     │   │   ├─ AABB × AABB
     │   │   ├─ Circle × Circle
     │   │   └─ AABB × Circle
     │   ├─ Impulse Resolver
     │   │   ├─ Baumgarte correction
     │   │   └─ Friction impulse
     │   ├─ Swept CCD (tunnelling)
     │   └─ Raycast (spatial hash)
     ├─ RenderSystem (Godot RS)
     │   ├─ Frustum Culler
     │   └─ TilemapRenderer
     ├─ LightingSystem
     │   ├─ G-buffer (color FBO)
     │   ├─ Light accum FBO
     │   └─ Composite pass
     ├─ ParticleEmitterSystem
     │   └─ GPU instanced quads
     ├─ AnimationSystem
     │   ├─ StateMachine
     │   └─ BlendTree1D
     ├─ CombatSystem
     ├─ ScriptSystem
     ├─ AudioSystem
     └─ VisibilityNotifier

ObjectPool (Godot/UE5 pooling)
 └─ PoolManager (named pools)

Desktop (Tauri v2)
 ├─ Rust core (lightweight)
 ├─ System WebView (no Chromium)
 ├─ Native file system access
 ├─ Window state persistence
 └─ Cross-platform bundles
     ├─ .exe (Windows)
     ├─ .dmg (macOS)
     └─ .AppImage (Linux)
`.trim()}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
