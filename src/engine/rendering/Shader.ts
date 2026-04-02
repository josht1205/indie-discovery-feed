// Shader — compiles and links GLSL programs, caches uniform locations
import { createLogger } from '../core/Logger';

const log = createLogger('Shader');

export class Shader {
  readonly program: WebGLProgram;
  private gl: WebGL2RenderingContext;
  private uniformCache = new Map<string, WebGLUniformLocation | null>();

  constructor(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
    this.gl = gl;
    const vert = this._compile(gl.VERTEX_SHADER, vertSrc);
    const frag = this._compile(gl.FRAGMENT_SHADER, fragSrc);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vert);
    gl.attachShader(this.program, frag);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.program);
      throw new Error(`Shader link failed: ${info}`);
    }
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    log.debug('Shader linked successfully');
  }

  use(): void { this.gl.useProgram(this.program); }

  getUniformLocation(name: string): WebGLUniformLocation | null {
    if (!this.uniformCache.has(name)) {
      this.uniformCache.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniformCache.get(name)!;
  }

  setFloat(name: string, v: number)      { const u = this.getUniformLocation(name); if (u) this.gl.uniform1f(u, v); }
  setInt  (name: string, v: number)      { const u = this.getUniformLocation(name); if (u) this.gl.uniform1i(u, v); }
  setVec2 (name: string, x: number, y: number) { const u = this.getUniformLocation(name); if (u) this.gl.uniform2f(u, x, y); }
  setVec4 (name: string, r: number, g: number, b: number, a: number) {
    const u = this.getUniformLocation(name); if (u) this.gl.uniform4f(u, r, g, b, a);
  }
  setMat4 (name: string, mat: Float32Array) {
    const u = this.getUniformLocation(name); if (u) this.gl.uniformMatrix4fv(u, false, mat);
  }

  getAttribLocation(name: string): number {
    return this.gl.getAttribLocation(this.program, name);
  }

  private _compile(type: number, src: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, src);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      const typeName = type === this.gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
      throw new Error(`[${typeName}] Shader compile error: ${info}`);
    }
    return shader;
  }

  destroy(): void {
    this.gl.deleteProgram(this.program);
  }
}
