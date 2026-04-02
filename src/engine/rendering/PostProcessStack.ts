// PostProcessStack — manages an offscreen framebuffer and applies post-fx via fullscreen quad
import { Shader } from './Shader';
import { POST_VERT, POST_FRAG } from './shaders/post.frag';
import { createLogger } from '../core/Logger';

const log = createLogger('PostProcess');

export interface PostFXSettings {
  bloomIntensity:      number;  // 0 = off
  vignetteStrength:    number;  // 0 = off
  chromaticAberration: number;  // 0 = off
  scanlineIntensity:   number;  // 0 = off
  saturation:          number;  // 1 = normal
  contrast:            number;  // 1 = normal
  brightness:          number;  // 0 = normal
}

export const DEFAULT_POST_FX: PostFXSettings = {
  bloomIntensity:      0,
  vignetteStrength:    0.4,
  chromaticAberration: 0,
  scanlineIntensity:   0,
  saturation:          1,
  contrast:            1,
  brightness:          0,
};

export class PostProcessStack {
  private gl: WebGL2RenderingContext;
  private shader: Shader;
  private fbo: WebGLFramebuffer;
  private colorTex: WebGLTexture;
  private quadVAO: WebGLVertexArrayObject;
  private width: number;
  private height: number;
  private time = 0;

  settings: PostFXSettings = { ...DEFAULT_POST_FX };

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl;
    this.width  = width;
    this.height = height;

    this.shader = new Shader(gl, POST_VERT, POST_FRAG);

    // Framebuffer
    this.fbo      = gl.createFramebuffer()!;
    this.colorTex = gl.createTexture()!;
    this._setupFBO(width, height);

    // Fullscreen quad
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = this.shader.getAttribLocation('a_position');
    if (loc >= 0) { gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc); }
    gl.bindVertexArray(null);

    log.debug('PostProcessStack created %dx%d', width, height);
  }

  private _setupFBO(w: number, h: number): void {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.colorTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  resize(w: number, h: number): void {
    this.width = w; this.height = h;
    this._setupFBO(w, h);
  }

  /** Bind the FBO; all rendering goes to the offscreen texture */
  bindFBO(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  /** Unbind FBO and draw the post-processed result to the default framebuffer */
  render(dt: number): void {
    this.time += dt;
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    this.shader.use();
    this.shader.setFloat('u_time', this.time);
    this.shader.setFloat('u_bloomIntensity',      this.settings.bloomIntensity);
    this.shader.setFloat('u_vignetteStrength',    this.settings.vignetteStrength);
    this.shader.setFloat('u_chromaticAberration', this.settings.chromaticAberration);
    this.shader.setFloat('u_scanlineIntensity',   this.settings.scanlineIntensity);
    this.shader.setFloat('u_saturation',          this.settings.saturation);
    this.shader.setFloat('u_contrast',            this.settings.contrast);
    this.shader.setFloat('u_brightness',          this.settings.brightness);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    this.shader.setInt('u_scene', 0);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
