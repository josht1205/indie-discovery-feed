// AnimationClip — describes a sequence of sprite frames
export interface AnimationFrame {
  // UV sub-rect [0..1] for this frame
  uvX: number; uvY: number; uvW: number; uvH: number;
  // How long this frame should display (seconds)
  duration: number;
}

export class AnimationClip {
  readonly name: string;
  readonly frames: AnimationFrame[];
  readonly loop:   boolean;
  readonly fps:    number;

  get totalDuration(): number {
    return this.frames.reduce((sum, f) => sum + f.duration, 0);
  }

  constructor(name: string, frames: AnimationFrame[], loop = true, fps = 12) {
    this.name   = name;
    this.frames = frames;
    this.loop   = loop;
    this.fps    = fps;
  }

  /**
   * Build a clip from a sprite sheet grid.
   * @param name  clip name
   * @param sheetW  total sheet width in pixels
   * @param sheetH  total sheet height in pixels
   * @param frameW  single frame width in pixels
   * @param frameH  single frame height in pixels
   * @param startFrame  first frame index (row-major)
   * @param frameCount  number of frames
   * @param fps   frames per second
   * @param loop  looping
   */
  static fromSpriteSheet(
    name: string,
    sheetW: number, sheetH: number,
    frameW: number, frameH: number,
    startFrame: number, frameCount: number,
    fps = 12, loop = true,
  ): AnimationClip {
    const cols = Math.floor(sheetW / frameW);
    const frameDuration = 1 / fps;
    const frames: AnimationFrame[] = [];

    for (let i = 0; i < frameCount; i++) {
      const fi = startFrame + i;
      const col = fi % cols;
      const row = Math.floor(fi / cols);
      frames.push({
        uvX: (col * frameW) / sheetW,
        uvY: (row * frameH) / sheetH,
        uvW: frameW / sheetW,
        uvH: frameH / sheetH,
        duration: frameDuration,
      });
    }
    return new AnimationClip(name, frames, loop, fps);
  }
}
