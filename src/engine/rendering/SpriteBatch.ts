// SpriteBatch — batches sprite draw calls into minimal GL draw calls
// Uses instanced rendering: one quad mesh, N per-instance transforms + UVs
import { Shader } from './Shader';
import { Texture } from './Texture';
import { SPRITE_VERT } from './shaders/sprite.vert';
import { SPRITE_FRAG } from './shaders/sprite.frag';
import { createLogger } from '../core/Logger';

const log = createLogger('SpriteBatch');

const MAX_SPRITES = 4096;

// Per-instance layout (floats): model0(4) + model1(4) + model2(4) + color(4) + uvRect(4) = 20
const INSTANCE_FLOATS = 20;

export interface SpriteDrawCall {
  texture:  Texture;
  x: number; y: number;
  width:    number; height: number;
  rotation: number;
  scaleX:   number; scaleY: number;
  r: number; g: number; b: number; a: number;
  // UV sub-rect within atlas [0..1]
  uvX: number; uvY: number; uvW: number; uvH: number;
  // Depth/layer
  z?: number;
}

export class SpriteBatch {
  private gl: WebGL2RenderingContext;
  private shader: Shader;
  private vao: WebGLVertexArrayObject;
  private quadVBO: WebGLBuffer;
  private instanceVBO: WebGLBuffer;
  private instanceData: Float32Array;
  private drawGroups: Array<{ texture: Texture; start: number; count: number }> = [];
  private currentCount = 0;
  private _drawCalls = 0;

  get drawCallCount() { return this._drawCalls; }

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.shader = new Shader(gl, SPRITE_VERT, SPRITE_FRAG);
    this.instanceData = new Float32Array(MAX_SPRITES * INSTANCE_FLOATS);

    // Unit quad [-0.5, 0.5] — positions + uvs
    const quadVerts = new Float32Array([
      // x      y     u   v
      -0.5,  0.5,  0.0, 1.0,
      -0.5, -0.5,  0.0, 0.0,
       0.5,  0.5,  1.0, 1.0,
       0.5, -0.5,  1.0, 0.0,
    ]);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    // Quad VBO
    this.quadVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const aPos = this.shader.getAttribLocation('a_position');
    const aUV  = this.shader.getAttribLocation('a_texCoord');
    const stride = 4 * 4; // 4 floats * 4 bytes
    if (aPos >= 0) { gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0); gl.enableVertexAttribArray(aPos); }
    if (aUV  >= 0) { gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, stride, 8); gl.enableVertexAttribArray(aUV); }

    // Instance VBO
    this.instanceVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);

    const iStride = INSTANCE_FLOATS * 4;
    const attrs = ['a_model0', 'a_model1', 'a_model2', 'a_color', 'a_uvRect'];
    attrs.forEach((name, i) => {
      const loc = this.shader.getAttribLocation(name);
      if (loc >= 0) {
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, iStride, i * 16);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribDivisor(loc, 1);
      }
    });

    gl.bindVertexArray(null);
    log.debug('SpriteBatch initialized, max sprites: %d', MAX_SPRITES);
  }

  begin(): void {
    this.currentCount = 0;
    this.drawGroups.length = 0;
    this._drawCalls = 0;
  }

  draw(call: SpriteDrawCall): void {
    if (this.currentCount >= MAX_SPRITES) {
      log.warn('SpriteBatch overflow — consider increasing MAX_SPRITES');
      return;
    }

    // Group by texture
    const last = this.drawGroups[this.drawGroups.length - 1];
    if (!last || last.texture !== call.texture) {
      this.drawGroups.push({ texture: call.texture, start: this.currentCount, count: 0 });
    }
    this.drawGroups[this.drawGroups.length - 1].count++;

    // Build instance data
    const base = this.currentCount * INSTANCE_FLOATS;
    const d = this.instanceData;

    // Model matrix (2D): scale → rotate → translate packed into 3 vec4s
    const c = Math.cos(call.rotation) * call.scaleX * call.width;
    const s = Math.sin(call.rotation) * call.scaleX * call.width;
    const nc = -Math.sin(call.rotation) * call.scaleY * call.height;
    const ns = Math.cos(call.rotation) * call.scaleY * call.height;

    // col 0
    d[base + 0] = c;  d[base + 1] = s;  d[base + 2] = 0; d[base + 3] = 0;
    // col 1
    d[base + 4] = nc; d[base + 5] = ns; d[base + 6] = 0; d[base + 7] = 0;
    // col 2 (translation)
    d[base + 8] = call.x; d[base + 9] = call.y; d[base + 10] = 0; d[base + 11] = 0;
    // color
    d[base + 12] = call.r; d[base + 13] = call.g; d[base + 14] = call.b; d[base + 15] = call.a;
    // uvRect
    d[base + 16] = call.uvX; d[base + 17] = call.uvY; d[base + 18] = call.uvW; d[base + 19] = call.uvH;

    this.currentCount++;
  }

  flush(projectionMatrix: Float32Array, viewMatrix: Float32Array): void {
    if (this.currentCount === 0) return;
    const gl = this.gl;

    this.shader.use();
    this.shader.setMat4('u_projection', projectionMatrix);
    this.shader.setMat4('u_view', viewMatrix);
    this.shader.setInt('u_texture', 0);

    // Upload all instance data at once
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData, 0, this.currentCount * INSTANCE_FLOATS);

    gl.bindVertexArray(this.vao);
    for (const group of this.drawGroups) {
      group.texture.bind(0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, group.count);
      this._drawCalls++;
    }
    gl.bindVertexArray(null);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.quadVBO);
    this.gl.deleteBuffer(this.instanceVBO);
    this.gl.deleteVertexArray(this.vao);
    this.shader.destroy();
  }
}
