// Renderer — top-level WebGL2 renderer managing the render pipeline
import { SpriteBatch, SpriteDrawCall } from './SpriteBatch';
import { PostProcessStack, PostFXSettings } from './PostProcessStack';
import { Camera } from './Camera';
import { Texture } from './Texture';
import { createLogger } from '../core/Logger';

const log = createLogger('Renderer');

export interface RendererConfig {
  canvas:       HTMLCanvasElement;
  width?:       number;
  height?:      number;
  postFX?:      Partial<PostFXSettings>;
  antialias?:   boolean;
  transparent?: boolean;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;

  private spriteBatch: SpriteBatch;
  private postStack:   PostProcessStack;
  private width:  number;
  private height: number;

  // Background clear color
  clearR = 0.05; clearG = 0.05; clearB = 0.08; clearA = 1;

  constructor(config: RendererConfig) {
    this.canvas = config.canvas;
    this.width  = config.width  ?? config.canvas.width;
    this.height = config.height ?? config.canvas.height;

    const gl = config.canvas.getContext('webgl2', {
      alpha: config.transparent ?? false,
      antialias: config.antialias ?? false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL2 not supported in this browser');
    this.gl = gl;

    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.spriteBatch = new SpriteBatch(gl);
    this.postStack   = new PostProcessStack(gl, this.width, this.height);

    if (config.postFX) Object.assign(this.postStack.settings, config.postFX);

    this.resize(this.width, this.height);
    log.info('Renderer initialized %dx%d', this.width, this.height);
  }

  resize(w: number, h: number): void {
    this.width  = w;
    this.height = h;
    this.canvas.width  = w;
    this.canvas.height = h;
    this.postStack.resize(w, h);
  }

  get postFX(): PostFXSettings { return this.postStack.settings; }

  beginFrame(camera: Camera): void {
    camera.viewWidth  = this.width;
    camera.viewHeight = this.height;

    // Render scene into offscreen FBO
    this.postStack.bindFBO();
    this.gl.clearColor(this.clearR, this.clearG, this.clearB, this.clearA);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.spriteBatch.begin();

    this._projMatrix = camera.getProjectionMatrix().data;
    this._viewMatrix = camera.getViewMatrix().data;
  }

  private _projMatrix!: Float32Array;
  private _viewMatrix!: Float32Array;

  drawSprite(call: SpriteDrawCall): void {
    this.spriteBatch.draw(call);
  }

  endFrame(dt: number): void {
    // Flush sprite batch
    this.spriteBatch.flush(this._projMatrix, this._viewMatrix);
    // Apply post-processing and blit to canvas
    this.postStack.render(dt);
  }

  /** Create a solid-color placeholder texture */
  createSolidTexture(r: number, g: number, b: number, a = 255): Texture {
    return Texture.createSolid(this.gl, r, g, b, a);
  }

  /** Load a texture from a URL */
  async loadTexture(url: string, pixelArt = true): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = new Texture(this.gl, img, {
          magFilter: pixelArt ? this.gl.NEAREST : this.gl.LINEAR,
          minFilter: pixelArt ? this.gl.NEAREST : this.gl.LINEAR_MIPMAP_LINEAR,
        });
        resolve(tex);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  get drawCalls(): number { return this.spriteBatch.drawCallCount; }

  destroy(): void {
    this.spriteBatch.destroy();
  }
}
