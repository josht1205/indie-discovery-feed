// RenderCommand — flat, sortable render data collected during the scene update
// Godot's RenderingServer decouples scene graph from GPU commands; we do the same.
// The scene graph populates a command list; the renderer flushes it once, sorted.
import { Texture } from './Texture';

export const enum RenderCommandType {
  Sprite   = 0,
  Particle = 1,
  TileMap  = 2,
  Light    = 3,
}

export interface SpriteCommand {
  type:     RenderCommandType.Sprite;
  texture:  Texture;
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  scaleX:   number; scaleY: number;
  r: number; g: number; b: number; a: number;
  uvX: number; uvY: number; uvW: number; uvH: number;
  sortKey:  number;  // layer * 1e9 + y-position for painter's order
}

export type RenderCommand = SpriteCommand; // extend union as new types added

// Pre-allocated command buffer — avoids GC pressure like Godot's arena allocator
export class RenderCommandBuffer {
  private commands: RenderCommand[] = [];
  private _count = 0;

  get count() { return this._count; }

  reset(): void { this._count = 0; }

  push(cmd: RenderCommand): void {
    // Reuse pre-allocated slot or expand
    if (this._count < this.commands.length) {
      this.commands[this._count] = cmd;
    } else {
      this.commands.push(cmd);
    }
    this._count++;
  }

  /** Sort commands by sortKey (layer + y depth) — in-place, avoids allocation */
  sort(): void {
    // Insertion sort for nearly-sorted arrays (common case each frame) — O(n) best case
    const cmds = this.commands;
    const len  = this._count;
    for (let i = 1; i < len; i++) {
      const key = cmds[i].sortKey;
      const val = cmds[i];
      let j = i - 1;
      while (j >= 0 && cmds[j].sortKey > key) {
        cmds[j + 1] = cmds[j];
        j--;
      }
      cmds[j + 1] = val;
    }
  }

  forEach(fn: (cmd: RenderCommand) => void): void {
    for (let i = 0; i < this._count; i++) fn(this.commands[i]);
  }

  get(i: number): RenderCommand { return this.commands[i]; }
}
