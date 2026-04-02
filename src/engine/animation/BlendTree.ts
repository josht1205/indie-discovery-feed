// BlendTree — 1D linear blend between animation clips (e.g., walk/run speed blend)
import { AnimationClip, AnimationFrame } from './AnimationClip';

export interface BlendNode {
  threshold: number;  // parameter value at which this node is fully active
  clip:      AnimationClip;
}

export interface BlendResult {
  uvX: number; uvY: number; uvW: number; uvH: number;
}

export class BlendTree1D {
  private nodes: BlendNode[];
  private timers: number[];

  constructor(nodes: BlendNode[]) {
    // Sort by threshold ascending
    this.nodes  = [...nodes].sort((a, b) => a.threshold - b.threshold);
    this.timers = new Array(this.nodes.length).fill(0);
  }

  /** Evaluate blend tree at given parameter value & advance time */
  update(dt: number, param: number): BlendResult {
    const nodes = this.nodes;
    if (nodes.length === 0) return { uvX: 0, uvY: 0, uvW: 1, uvH: 1 };
    if (nodes.length === 1) {
      const t = (this.timers[0] += dt) % nodes[0].clip.totalDuration;
      return this._frameAt(nodes[0].clip, t);
    }

    // Find the two bracketing nodes
    let lo = 0, hi = nodes.length - 1;
    for (let i = 0; i < nodes.length - 1; i++) {
      if (param >= nodes[i].threshold && param <= nodes[i + 1].threshold) {
        lo = i; hi = i + 1; break;
      }
      if (param < nodes[0].threshold)  { lo = hi = 0; break; }
      if (param > nodes[nodes.length - 1].threshold) { lo = hi = nodes.length - 1; break; }
    }

    const range = nodes[hi].threshold - nodes[lo].threshold;
    const alpha = range > 0 ? (param - nodes[lo].threshold) / range : 0;

    // Advance both timers in sync (normalized)
    const loClip = nodes[lo].clip;
    const hiClip = nodes[hi].clip;
    this.timers[lo] = (this.timers[lo] + dt) % loClip.totalDuration;
    this.timers[hi] = (this.timers[hi] + dt) % hiClip.totalDuration;

    const loFrame = this._frameAt(loClip, this.timers[lo]);
    const hiFrame = this._frameAt(hiClip, this.timers[hi]);

    // Lerp UV rects
    return {
      uvX: loFrame.uvX + (hiFrame.uvX - loFrame.uvX) * alpha,
      uvY: loFrame.uvY + (hiFrame.uvY - loFrame.uvY) * alpha,
      uvW: loFrame.uvW + (hiFrame.uvW - loFrame.uvW) * alpha,
      uvH: loFrame.uvH + (hiFrame.uvH - loFrame.uvH) * alpha,
    };
  }

  private _frameAt(clip: AnimationClip, time: number): AnimationFrame {
    let accum = 0;
    for (const frame of clip.frames) {
      accum += frame.duration;
      if (time <= accum) return frame;
    }
    return clip.frames[clip.frames.length - 1];
  }
}
