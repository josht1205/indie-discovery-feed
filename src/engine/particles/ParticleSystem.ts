// ParticleSystem — GPU-instanced particle renderer (UE5 Niagara-inspired)
// CPU updates typed arrays → single instanced draw call → GPU renders 100k+ particles
// Supports: gravity, drag, color-over-lifetime, size-over-lifetime, rotation, atlas UVs
import { Shader }  from '../rendering/Shader';
import { Texture } from '../rendering/Texture';
import { PARTICLE_VERT } from '../rendering/shaders/particle.vert';
import { PARTICLE_FRAG } from '../rendering/shaders/particle.frag';
import { MathUtils } from '../math/MathUtils';
import { Vec2 } from '../math/Vec2';
import { createLogger } from '../core/Logger';

const log = createLogger('ParticleSystem');

export interface ParticleModuleColor {
  startColor: [number,number,number,number];
  endColor:   [number,number,number,number];
}

export interface ParticleModuleSize {
  startSize: number;
  endSize:   number;
  startSizeY?: number;  // if undefined, uses startSize (square)
}

export interface ParticleModuleVelocity {
  minSpeed: number;
  maxSpeed: number;
  spreadAngle: number;    // degrees from emit direction
  emitDirection: number;  // radians
  gravity: Vec2;
  drag:    number;        // velocity multiplier per second [0..1]
}

export interface ParticleModuleLifetime {
  minLifetime: number;
  maxLifetime: number;
}

export interface ParticleEmissionParams {
  maxParticles:   number;
  emissionRate:   number;    // particles per second (0 = burst only)
  burstCount?:    number;    // one-shot burst
  looping:        boolean;

  // Emitter shape
  shapeType:  'point' | 'circle' | 'rect';
  shapeRadius?: number;       // for circle
  shapeWidth?:  number;       // for rect
  shapeHeight?: number;       // for rect

  // Sub-modules
  color:    ParticleModuleColor;
  size:     ParticleModuleSize;
  velocity: ParticleModuleVelocity;
  lifetime: ParticleModuleLifetime;

  // Rotation
  startRotation: number;
  rotationSpeed: number;     // radians/s

  // Atlas UV (defaults to full texture)
  uvX: number; uvY: number; uvW: number; uvH: number;

  // Blend: 0=alpha, 1=additive, 2=multiply
  blendMode: 0 | 1 | 2;
  softEdge:  boolean;
}

export const DEFAULT_EMISSION: ParticleEmissionParams = {
  maxParticles:   1000,
  emissionRate:   100,
  looping:        true,
  shapeType:      'point',
  color:    { startColor:[1,1,1,1], endColor:[1,1,1,0] },
  size:     { startSize: 16, endSize: 0 },
  velocity: { minSpeed:50, maxSpeed:150, spreadAngle:360, emitDirection:0, gravity:new Vec2(0,-50), drag:0.98 },
  lifetime: { minLifetime:0.5, maxLifetime:2 },
  startRotation: 0,
  rotationSpeed: 0,
  uvX:0, uvY:0, uvW:1, uvH:1,
  blendMode: 0,
  softEdge: true,
};

// Per-particle CPU state
interface ParticleState {
  alive:    boolean;
  x:        number; y:        number;
  vx:       number; vy:       number;
  life:     number; maxLife:  number;
  rotation: number; rotSpeed: number;
}

// Instanced vertex layout (floats per particle):
// pos(2) + rotation(1) + size(2) + color(4) + life(1) + uvRect(4) = 14 floats
const FLOATS_PER_PARTICLE = 14;

export class ParticleSystem {
  private gl:     WebGL2RenderingContext;
  private shader: Shader;
  private vao:    WebGLVertexArrayObject;
  private quadVBO: WebGLBuffer;
  private instanceVBO: WebGLBuffer;

  private particles: ParticleState[];
  private instanceData: Float32Array;
  private emitAccum = 0;
  private time      = 0;

  texture: Texture | null = null;
  params:  ParticleEmissionParams;

  // World position of the emitter
  x = 0; y = 0;

  private _liveCount = 0;
  get liveCount() { return this._liveCount; }

  constructor(gl: WebGL2RenderingContext, params: Partial<ParticleEmissionParams> = {}) {
    this.gl     = gl;
    this.params = { ...DEFAULT_EMISSION, ...params };
    const max   = this.params.maxParticles;

    this.particles    = Array.from({ length: max }, () => ({ alive:false, x:0,y:0,vx:0,vy:0,life:0,maxLife:1,rotation:0,rotSpeed:0 }));
    this.instanceData = new Float32Array(max * FLOATS_PER_PARTICLE);

    this.shader = new Shader(gl, PARTICLE_VERT, PARTICLE_FRAG);
    this._buildVAO();

    log.debug('ParticleSystem ready: max=%d', max);
  }

  private _buildVAO(): void {
    const gl     = this.gl;
    const shader = this.shader;

    const quadVerts = new Float32Array([
      -0.5,  0.5,  0, 1,
      -0.5, -0.5,  0, 0,
       0.5,  0.5,  1, 1,
       0.5, -0.5,  1, 0,
    ]);

    this.vao     = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    this.quadVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const aPos = shader.getAttribLocation('a_position');
    const aUV  = shader.getAttribLocation('a_texCoord');
    if (aPos >= 0) { gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);  gl.enableVertexAttribArray(aPos); }
    if (aUV  >= 0) { gl.vertexAttribPointer(aUV,  2, gl.FLOAT, false, 16, 8);  gl.enableVertexAttribArray(aUV); }

    this.instanceVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);

    const stride = FLOATS_PER_PARTICLE * 4;
    const attrs: [string, number, number][] = [
      ['a_pos',      2,  0],
      ['a_rotation', 1,  8],
      ['a_size',     2, 12],
      ['a_color',    4, 20],
      ['a_life',     1, 36],
      ['a_uvRect',   4, 40],
    ];
    for (const [name, size, byteOffset] of attrs) {
      const loc = shader.getAttribLocation(name);
      if (loc >= 0) {
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, byteOffset);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribDivisor(loc, 1);
      }
    }
    gl.bindVertexArray(null);
  }

  /** Emit a one-shot burst */
  burst(count?: number): void {
    const n = count ?? this.params.burstCount ?? 10;
    for (let i = 0; i < n; i++) this._spawnOne();
  }

  update(dt: number): void {
    this.time += dt;
    const p = this.params;

    // Emission
    if (p.emissionRate > 0 && p.looping) {
      this.emitAccum += p.emissionRate * dt;
      while (this.emitAccum >= 1) { this._spawnOne(); this.emitAccum--; }
    }

    const gx = p.velocity.gravity.x;
    const gy = p.velocity.gravity.y;
    const drag = Math.pow(p.velocity.drag, dt);

    this._liveCount = 0;
    for (let i = 0; i < p.maxParticles; i++) {
      const part = this.particles[i];
      if (!part.alive) continue;

      part.life -= dt;
      if (part.life <= 0) { part.alive = false; continue; }

      // Gravity + drag
      part.vx = (part.vx + gx * dt) * drag;
      part.vy = (part.vy + gy * dt) * drag;
      part.x  += part.vx * dt;
      part.y  += part.vy * dt;
      part.rotation += part.rotSpeed * dt;

      // Write instance data
      const t   = 1 - part.life / part.maxLife;  // [0..1] progress
      const lifN = part.life / part.maxLife;       // [1..0] normalized remaining

      const r = MathUtils.lerp(p.color.startColor[0], p.color.endColor[0], t);
      const g = MathUtils.lerp(p.color.startColor[1], p.color.endColor[1], t);
      const b = MathUtils.lerp(p.color.startColor[2], p.color.endColor[2], t);
      const a = MathUtils.lerp(p.color.startColor[3], p.color.endColor[3], t);
      const sw = MathUtils.lerp(p.size.startSize,   p.size.endSize,   t);
      const sh = MathUtils.lerp(p.size.startSizeY ?? p.size.startSize, p.size.endSize, t);

      const base = this._liveCount * FLOATS_PER_PARTICLE;
      const d    = this.instanceData;
      d[base+0]  = part.x;  d[base+1]  = part.y;
      d[base+2]  = part.rotation;
      d[base+3]  = sw;       d[base+4]  = sh;
      d[base+5]  = r;        d[base+6]  = g;  d[base+7] = b; d[base+8] = a;
      d[base+9]  = lifN;
      d[base+10] = p.uvX;   d[base+11] = p.uvY; d[base+12] = p.uvW; d[base+13] = p.uvH;

      this._liveCount++;
    }
  }

  draw(projMatrix: Float32Array, viewMatrix: Float32Array): void {
    if (this._liveCount === 0 || !this.texture) return;
    const gl = this.gl;

    this.shader.use();
    this.shader.setMat4('u_projection', projMatrix);
    this.shader.setMat4('u_view',       viewMatrix);
    this.shader.setInt('u_texture',   0);
    this.shader.setFloat('u_softEdge', this.params.softEdge ? 1 : 0);
    this.shader.setInt('u_blendMode', this.params.blendMode);

    // Set blend mode
    if (this.params.blendMode === 1) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);  // additive
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    this.texture.bind(0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData, 0, this._liveCount * FLOATS_PER_PARTICLE);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this._liveCount);
    gl.bindVertexArray(null);

    // Restore default blend
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private _spawnOne(): void {
    const p = this.params;
    for (let i = 0; i < p.maxParticles; i++) {
      const part = this.particles[i];
      if (part.alive) continue;

      // Emitter shape
      let ox = 0, oy = 0;
      if (p.shapeType === 'circle') {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (p.shapeRadius ?? 10);
        ox = Math.cos(a) * r; oy = Math.sin(a) * r;
      } else if (p.shapeType === 'rect') {
        ox = MathUtils.randFloat(-(p.shapeWidth ?? 10)/2, (p.shapeWidth ?? 10)/2);
        oy = MathUtils.randFloat(-(p.shapeHeight ?? 10)/2, (p.shapeHeight ?? 10)/2);
      }

      // Velocity
      const spread = MathUtils.toRad(p.velocity.spreadAngle / 2);
      const angle  = p.velocity.emitDirection + MathUtils.randFloat(-spread, spread);
      const speed  = MathUtils.randFloat(p.velocity.minSpeed, p.velocity.maxSpeed);

      part.alive    = true;
      part.x        = this.x + ox;
      part.y        = this.y + oy;
      part.vx       = Math.cos(angle) * speed;
      part.vy       = Math.sin(angle) * speed;
      part.maxLife  = MathUtils.randFloat(p.lifetime.minLifetime, p.lifetime.maxLifetime);
      part.life     = part.maxLife;
      part.rotation = p.startRotation;
      part.rotSpeed = p.rotationSpeed;
      return;
    }
  }

  destroy(): void {
    this.shader.destroy();
    this.gl.deleteBuffer(this.quadVBO);
    this.gl.deleteBuffer(this.instanceVBO);
    this.gl.deleteVertexArray(this.vao);
  }
}
