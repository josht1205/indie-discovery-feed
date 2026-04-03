// DebugDraw — immediate-mode overlay for physics bounds, lights, rays, vectors
// Like UE5's draw debug helpers and Godot's debug shapes — zero cost in release builds.
// Uses a Canvas2D overlay on top of the WebGL canvas so it never touches the render pipeline.

import { Camera } from './Camera';
import { Vec2 }   from '../math/Vec2';

export interface DebugDrawConfig {
  enabled:     boolean;
  showPhysics: boolean;   // AABB/circle collider bounds
  showLights:  boolean;   // light radius circles
  showRays:    boolean;   // raycast lines
  showVelocity:boolean;   // velocity arrows on rigidbodies
  showGrid:    boolean;   // world-space grid
  showFPS:     boolean;   // performance overlay
  gridSize:    number;    // world units
}

export const DEFAULT_DEBUG_CONFIG: DebugDrawConfig = {
  enabled:      false,    // off by default; toggle with F3
  showPhysics:  true,
  showLights:   true,
  showRays:     true,
  showVelocity: true,
  showGrid:     false,
  showFPS:      true,
  gridSize:     64,
};

interface DrawCmd {
  type: 'rect' | 'circle' | 'line' | 'text' | 'arrow';
  x: number; y: number;
  x2?: number; y2?: number;
  w?: number; h?: number;
  r?: number;
  label?: string;
  color: string;
  lineWidth?: number;
  fill?: boolean;
  duration: number;   // seconds; 0 = one frame only
}

export class DebugDraw {
  private canvas2d!: HTMLCanvasElement;
  private ctx!:      CanvasRenderingContext2D;
  private cmds:      DrawCmd[] = [];

  config: DebugDrawConfig = { ...DEFAULT_DEBUG_CONFIG };

  /** Call once with the WebGL canvas to create a 2D overlay on top */
  mount(glCanvas: HTMLCanvasElement): void {
    this.canvas2d = document.createElement('canvas');
    this.canvas2d.width  = glCanvas.width;
    this.canvas2d.height = glCanvas.height;
    Object.assign(this.canvas2d.style, {
      position:      'absolute',
      top:           '0', left:     '0',
      width:         '100%', height: '100%',
      pointerEvents: 'none',
      zIndex:        '10',
    });
    glCanvas.parentElement?.appendChild(this.canvas2d);
    this.ctx = this.canvas2d.getContext('2d')!;

    // F3 toggles debug overlay
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') { this.config.enabled = !this.config.enabled; e.preventDefault(); }
    });
  }

  resize(w: number, h: number): void {
    if (!this.canvas2d) return;
    this.canvas2d.width  = w;
    this.canvas2d.height = h;
  }

  // ── Immediate-mode API (call each frame from your game code) ─────────────

  rect(x: number, y: number, w: number, h: number, color = '#00ff88', duration = 0): void {
    if (!this.config.enabled) return;
    this.cmds.push({ type: 'rect', x, y, w, h, color, duration, fill: false });
  }

  rectFilled(x: number, y: number, w: number, h: number, color = '#00ff8844', duration = 0): void {
    if (!this.config.enabled) return;
    this.cmds.push({ type: 'rect', x, y, w, h, color, duration, fill: true });
  }

  circle(x: number, y: number, r: number, color = '#ff8800', duration = 0): void {
    if (!this.config.enabled) return;
    this.cmds.push({ type: 'circle', x, y, r, color, duration, fill: false });
  }

  line(x1: number, y1: number, x2: number, y2: number, color = '#ffffff', lineWidth = 1, duration = 0): void {
    if (!this.config.enabled) return;
    this.cmds.push({ type: 'line', x: x1, y: y1, x2, y2, color, lineWidth, duration });
  }

  arrow(from: Vec2, to: Vec2, color = '#ffff00', duration = 0): void {
    if (!this.config.enabled) return;
    this.cmds.push({ type: 'arrow', x: from.x, y: from.y, x2: to.x, y2: to.y, color, duration });
  }

  text(x: number, y: number, label: string, color = '#ffffff', duration = 0): void {
    if (!this.config.enabled) return;
    this.cmds.push({ type: 'text', x, y, label, color, duration });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  render(dt: number, camera: Camera, fps: number, drawCalls: number, entities: number): void {
    if (!this.ctx || !this.canvas2d) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas2d.width, this.canvas2d.height);

    if (!this.config.enabled) return;

    const toScreen = (wx: number, wy: number): [number, number] => {
      const s = camera.worldToScreen(wx, wy);
      return [s.x, s.y];
    };

    // Grid
    if (this.config.showGrid) {
      const step = this.config.gridSize * camera.zoom;
      ctx.strokeStyle = '#ffffff18';
      ctx.lineWidth   = 1;
      const offX = ((-camera.position.x * camera.zoom) % step + camera.viewWidth  / 2) % step;
      const offY = ((-camera.position.y * camera.zoom) % step + camera.viewHeight / 2) % step;
      ctx.beginPath();
      for (let x = offX; x < this.canvas2d.width;  x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas2d.height); }
      for (let y = offY; y < this.canvas2d.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(this.canvas2d.width, y); }
      ctx.stroke();
    }

    // Immediate draw commands
    const remaining: DrawCmd[] = [];
    for (const cmd of this.cmds) {
      this._drawCmd(ctx, cmd, toScreen);
      cmd.duration -= dt;
      if (cmd.duration > 0) remaining.push(cmd);
    }
    this.cmds = remaining;

    // FPS / stats overlay
    if (this.config.showFPS) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(8, 8, 180, 70);
      ctx.fillStyle = fps >= 50 ? '#4ade80' : fps >= 30 ? '#facc15' : '#f87171';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`FPS: ${fps}`, 16, 28);
      ctx.fillStyle = '#a78bfa';
      ctx.fillText(`Draw calls: ${drawCalls}`, 16, 44);
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`Entities: ${entities}`, 16, 60);
    }

    // Axis cross at world origin
    const [ox, oy] = toScreen(0, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff4444';
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 40 * camera.zoom, oy); ctx.stroke();
    ctx.strokeStyle = '#44ff44';
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 40 * camera.zoom); ctx.stroke();
  }

  private _drawCmd(
    ctx:      CanvasRenderingContext2D,
    cmd:      DrawCmd,
    toScreen: (wx: number, wy: number) => [number, number],
  ): void {
    ctx.strokeStyle = cmd.color;
    ctx.fillStyle   = cmd.color;
    ctx.lineWidth   = cmd.lineWidth ?? 1;

    if (cmd.type === 'rect') {
      const [sx, sy] = toScreen(cmd.x - (cmd.w ?? 0) / 2, cmd.y + (cmd.h ?? 0) / 2);
      if (cmd.fill) ctx.fillRect(sx, sy, cmd.w ?? 0, -(cmd.h ?? 0));
      else          ctx.strokeRect(sx, sy, cmd.w ?? 0, -(cmd.h ?? 0));

    } else if (cmd.type === 'circle') {
      const [sx, sy] = toScreen(cmd.x, cmd.y);
      ctx.beginPath();
      ctx.arc(sx, sy, cmd.r ?? 8, 0, Math.PI * 2);
      if (cmd.fill) ctx.fill(); else ctx.stroke();

    } else if (cmd.type === 'line') {
      const [x1, y1] = toScreen(cmd.x, cmd.y);
      const [x2, y2] = toScreen(cmd.x2 ?? 0, cmd.y2 ?? 0);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    } else if (cmd.type === 'arrow') {
      const [x1, y1] = toScreen(cmd.x, cmd.y);
      const [x2, y2] = toScreen(cmd.x2 ?? 0, cmd.y2 ?? 0);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const len   = 8;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4));
      ctx.stroke();

    } else if (cmd.type === 'text') {
      const [sx, sy] = toScreen(cmd.x, cmd.y);
      ctx.font = '11px monospace';
      ctx.fillText(cmd.label ?? '', sx, sy);
    }
  }

  destroy(): void {
    this.canvas2d?.parentElement?.removeChild(this.canvas2d);
  }
}

export const globalDebug = new DebugDraw();
