// LightingSystem — 2D deferred lighting pipeline (UE5 Lumen for 2D)
// Architecture:
//   Pass 1 (scene FBO)  → sprite rendering to G-buffer (color + optional normals)
//   Pass 2 (light FBO)  → additive point-light accumulation (one quad per light)
//   Pass 3 (composite)  → albedo * (ambient + lights) → final image
//
// This matches Godot 4's 2D lighting architecture and echoes UE5's deferred shading.
import { Shader }   from './Shader';
import { Light2D }  from './Light2D';
import { System }   from '../ecs/System';
import { Transform } from '../math/Transform';
import { Camera }   from './Camera';
import { LIGHT2D_FRAG, POINT_LIGHT_FRAG } from './shaders/light2d.frag';
import { POST_VERT } from './shaders/post.frag';
import { MathUtils } from '../math/MathUtils';
import { createLogger } from '../core/Logger';

const log = createLogger('LightingSystem');

export interface LightingConfig {
  ambientR: number; ambientG: number; ambientB: number;  // [0..1]
  maxLights: number;
  useNormals: boolean;
}

export const DEFAULT_LIGHTING: LightingConfig = {
  ambientR: 0.08, ambientG: 0.08, ambientB: 0.15,
  maxLights: 64,
  useNormals: false,
};

export class LightingSystem extends System {
  priority = 90;

  private gl!: WebGL2RenderingContext;
  private width  = 800;
  private height = 600;

  // G-buffer
  private colorFBO!:  WebGLFramebuffer;
  private colorTex!:  WebGLTexture;

  // Light accumulation buffer
  private lightFBO!:  WebGLFramebuffer;
  private lightTex!:  WebGLTexture;

  // Shaders
  private lightAccumShader!: Shader;  // one light additive pass
  private compositeShader!:  Shader;  // combine albedo + light

  private quadVAO!: WebGLVertexArrayObject;

  config: LightingConfig;
  enabled = true;

  constructor(config: Partial<LightingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_LIGHTING, ...config };
  }

  initGL(gl: WebGL2RenderingContext, width: number, height: number): void {
    this.gl = gl;
    this.width = width; this.height = height;

    this.lightAccumShader = new Shader(gl, POST_VERT, POINT_LIGHT_FRAG);
    this.compositeShader  = new Shader(gl, POST_VERT, LIGHT2D_FRAG);

    this._buildFBOs();
    this._buildQuadVAO();

    log.info('LightingSystem GL initialized %dx%d', width, height);
  }

  resize(w: number, h: number): void {
    this.width = w; this.height = h;
    this._buildFBOs();
  }

  /** Bind the color G-buffer for the sprite rendering pass */
  bindColorFBO(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.colorFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Run the light accumulation pass + composite pass, output to bound framebuffer */
  renderLights(outputFBO: WebGLFramebuffer | null, camera: Camera, time: number): void {
    const gl = this.gl;

    // ── Pass 2: Light accumulation ────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE);   // additive blend for light accumulation

    const lights = this.world?.query(Light2D, Transform) ?? [];
    const shader = this.lightAccumShader;
    shader.use();
    shader.setVec2('u_resolution', this.width, this.height);
    shader.setInt('u_normalTex', 0);
    shader.setInt('u_useNormals', this.config.useNormals ? 1 : 0);

    for (const e of lights) {
      const light = e.requireComponent(Light2D);
      const tf    = e.requireComponent(Transform);
      if (!light.enabled) continue;

      // Flicker
      light._flickerOffset = light.flickerAmount > 0
        ? Math.sin(time * light.flickerSpeed + e.id) * light.flickerAmount
        : 0;

      // Convert world → screen space for the shader
      const screenPos = camera.worldToScreen(tf.position.x, tf.position.y);

      shader.setVec2('u_lightPos', screenPos.x, this.height - screenPos.y); // flip Y for GL
      shader.setVec4('u_lightColor',
        light.r, light.g, light.b,
        light.intensity * (1 + light._flickerOffset),
      );
      shader.setFloat('u_lightRadius',    light.radius * camera.zoom);
      shader.setFloat('u_lightIntensity', light.intensity * (1 + light._flickerOffset));
      shader.setFloat('u_lightZ',         light.z);

      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    // Restore alpha blend
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── Pass 3: Composite ─────────────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO);
    gl.viewport(0, 0, this.width, this.height);

    this.compositeShader.use();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.colorTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.lightTex);
    this.compositeShader.setInt('u_colorTex', 0);
    this.compositeShader.setInt('u_lightTex', 2);
    this.compositeShader.setVec4('u_ambient',
      this.config.ambientR, this.config.ambientG, this.config.ambientB, 1,
    );
    this.compositeShader.setInt('u_useNormals', this.config.useNormals ? 1 : 0);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private _buildFBOs(): void {
    const gl = this.gl;
    const w = this.width, h = this.height;

    const makeFBO = (tex: WebGLTexture | null, fbo: WebGLFramebuffer | null): [WebGLFramebuffer, WebGLTexture] => {
      if (tex)  gl.deleteTexture(tex);
      if (fbo)  gl.deleteFramebuffer(fbo);

      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return [f, t];
    };

    [this.colorFBO, this.colorTex] = makeFBO(this.colorTex ?? null, this.colorFBO ?? null);
    [this.lightFBO, this.lightTex] = makeFBO(this.lightTex ?? null, this.lightFBO ?? null);
  }

  private _buildQuadVAO(): void {
    const gl    = this.gl;
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = this.lightAccumShader.getAttribLocation('a_position');
    if (loc >= 0) { gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc); }
    gl.bindVertexArray(null);
  }
}
