// Texture — wraps a WebGL texture, handles upload and atlas sub-rect
import { createLogger } from '../core/Logger';

const log = createLogger('Texture');

export interface TextureOptions {
  minFilter?: number;
  magFilter?: number;
  wrapS?:     number;
  wrapT?:     number;
  flipY?:     boolean;
}

export class Texture {
  readonly glTexture: WebGLTexture;
  readonly width: number;
  readonly height: number;
  private gl: WebGL2RenderingContext;

  constructor(
    gl: WebGL2RenderingContext,
    source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
    opts: TextureOptions = {},
  ) {
    this.gl = gl;
    this.width  = (source as HTMLImageElement).width;
    this.height = (source as HTMLImageElement).height;

    const tex = gl.createTexture()!;
    this.glTexture = tex;

    gl.bindTexture(gl.TEXTURE_2D, tex);

    if (opts.flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
      source as TexImageSource,
    );

    const min = opts.minFilter ?? gl.LINEAR_MIPMAP_LINEAR;
    const mag = opts.magFilter ?? gl.NEAREST; // pixel-art default
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT ?? gl.CLAMP_TO_EDGE);

    if (min === gl.LINEAR_MIPMAP_LINEAR || min === gl.NEAREST_MIPMAP_NEAREST) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    if (opts.flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.bindTexture(gl.TEXTURE_2D, null);
    log.debug('Texture uploaded %dx%d', this.width, this.height);
  }

  bind(unit = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.glTexture);
  }

  /** Create a 1x1 solid-color fallback texture */
  static createSolid(gl: WebGL2RenderingContext, r: number, g: number, b: number, a = 255): Texture {
    const data = new ImageData(new Uint8ClampedArray([r, g, b, a]), 1, 1);
    return new Texture(gl, data, { minFilter: gl.NEAREST, magFilter: gl.NEAREST });
  }

  destroy(): void {
    this.gl.deleteTexture(this.glTexture);
  }
}
