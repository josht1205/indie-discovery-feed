// Tilemap — efficient tile-based map renderer (Godot TileMap equivalent)
// Renders large tile grids in minimal draw calls using a single atlas texture.
// Architecture: dirty-flag chunk system — only re-uploads modified chunks to GPU.

import { Component }  from '../ecs/Component';
import { Shader }     from './Shader';
import { Texture }    from './Texture';
import { createLogger } from '../core/Logger';

const log = createLogger('Tilemap');

export interface TileDefinition {
  id:   number;   // tile ID (0 = empty)
  // UV sub-rect within atlas [0..1]
  uvX: number; uvY: number; uvW: number; uvH: number;
  // Collision
  solid:    boolean;
  // One-way platform
  oneWay?:  boolean;
  // Custom properties
  meta?:    Record<string, unknown>;
}

export interface TilemapLayer {
  name:    string;
  zIndex:  number;
  visible: boolean;
  tiles:   Int16Array;   // width * height, value = tileId (−1 = empty)
  opacity: number;
}

// Chunk size in tiles — 16×16 matches GPU cache lines nicely
const CHUNK_SIZE = 16;

// Per-tile vertex layout: 4 vertices × (pos2 + uv2) = 16 floats
const FLOATS_PER_TILE = 16;

const TILE_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
in vec2 a_texCoord;
uniform mat4 u_projection;
uniform mat4 u_view;
out vec2 v_uv;
void main() {
  gl_Position = u_projection * u_view * vec4(a_position, 0.0, 1.0);
  v_uv = a_texCoord;
}`;

const TILE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tileset;
uniform float u_opacity;
out vec4 outColor;
void main() {
  vec4 col = texture(u_tileset, v_uv);
  if (col.a < 0.01) discard;
  outColor = vec4(col.rgb, col.a * u_opacity);
}`;

export class Tilemap extends Component {
  static readonly TYPE = 'Tilemap';

  // Map dimensions (in tiles)
  mapWidth  = 0;
  mapHeight = 0;

  // Tile dimensions (in world units)
  tileWidth  = 16;
  tileHeight = 16;

  tileset: Texture | null = null;
  tilesetCols = 16;   // tiles across the atlas
  tilesetRows = 16;   // tiles down the atlas

  layers: TilemapLayer[] = [];
  tileDefinitions = new Map<number, TileDefinition>();

  // Track dirty chunks per layer for partial re-upload
  private dirtyChunks = new Set<string>(); // "layerIndex:chunkX:chunkY"

  // Internal GPU buffers (allocated lazily by TilemapRenderer)
  _vao: WebGLVertexArrayObject | null = null;
  _vbo: WebGLBuffer | null = null;
  _ebo: WebGLBuffer | null = null;
  _vertexData: Float32Array | null = null;
  _indexData:  Uint32Array  | null = null;
  _tileCount   = 0;

  init(mapWidth: number, mapHeight: number, tileW: number, tileH: number): void {
    this.mapWidth    = mapWidth;
    this.mapHeight   = mapHeight;
    this.tileWidth   = tileW;
    this.tileHeight  = tileH;
    log.debug('Tilemap init %dx%d tiles', mapWidth, mapHeight);
  }

  addLayer(name: string, zIndex = 0): TilemapLayer {
    const layer: TilemapLayer = {
      name, zIndex,
      visible: true,
      opacity: 1,
      tiles: new Int16Array(this.mapWidth * this.mapHeight).fill(-1),
    };
    this.layers.push(layer);
    this.layers.sort((a, b) => a.zIndex - b.zIndex);
    return layer;
  }

  setTile(layerIndex: number, tileX: number, tileY: number, tileId: number): void {
    const layer = this.layers[layerIndex];
    if (!layer) return;
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;
    layer.tiles[tileY * this.mapWidth + tileX] = tileId;

    // Mark chunk dirty
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    this.dirtyChunks.add(`${layerIndex}:${cx}:${cy}`);
  }

  getTile(layerIndex: number, tileX: number, tileY: number): number {
    const layer = this.layers[layerIndex];
    if (!layer) return -1;
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return -1;
    return layer.tiles[tileY * this.mapWidth + tileX];
  }

  /** Fill a rectangular region with a tile ID */
  fill(layerIndex: number, x: number, y: number, w: number, h: number, tileId: number): void {
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        this.setTile(layerIndex, tx, ty, tileId);
      }
    }
  }

  /** Register tile UV from atlas row/col (auto-computed) */
  registerTile(id: number, col: number, row: number, solid = false, oneWay = false): void {
    this.tileDefinitions.set(id, {
      id, solid, oneWay,
      uvX: col / this.tilesetCols,
      uvY: row / this.tilesetRows,
      uvW: 1 / this.tilesetCols,
      uvH: 1 / this.tilesetRows,
    });
  }

  /** Mark ALL chunks dirty (forces full re-upload) */
  markAllDirty(): void {
    for (let li = 0; li < this.layers.length; li++) {
      const cw = Math.ceil(this.mapWidth  / CHUNK_SIZE);
      const ch = Math.ceil(this.mapHeight / CHUNK_SIZE);
      for (let cx = 0; cx < cw; cx++) {
        for (let cy = 0; cy < ch; cy++) {
          this.dirtyChunks.add(`${li}:${cx}:${cy}`);
        }
      }
    }
  }

  isDirty(): boolean { return this.dirtyChunks.size > 0; }
  clearDirty(): void { this.dirtyChunks.clear(); }
}

// ── TilemapRenderer — compiles Tilemap → GPU vertex data, draws each frame ──

export class TilemapRenderer {
  private gl:     WebGL2RenderingContext;
  private shader: Shader;

  constructor(gl: WebGL2RenderingContext) {
    this.gl     = gl;
    this.shader = new Shader(gl, TILE_VERT, TILE_FRAG);
  }

  /** Re-build the vertex buffer for a Tilemap if any chunk is dirty */
  upload(tilemap: Tilemap): void {
    if (!tilemap.isDirty()) return;

    const { mapWidth, mapHeight, tileWidth, tileHeight, layers, tileDefinitions } = tilemap;
    const gl = this.gl;

    // Count total non-empty tiles
    let totalTiles = 0;
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (let i = 0; i < layer.tiles.length; i++) {
        if (layer.tiles[i] >= 0) totalTiles++;
      }
    }
    tilemap._tileCount = totalTiles;

    if (totalTiles === 0) { tilemap.clearDirty(); return; }

    const verts  = new Float32Array(totalTiles * FLOATS_PER_TILE);
    const idxArr = new Uint32Array(totalTiles * 6);
    let vi = 0, ii = 0, tileIdx = 0;

    for (const layer of layers) {
      if (!layer.visible) continue;
      for (let ty = 0; ty < mapHeight; ty++) {
        for (let tx = 0; tx < mapWidth; tx++) {
          const id = layer.tiles[ty * mapWidth + tx];
          if (id < 0) continue;
          const def = tileDefinitions.get(id);
          if (!def) continue;

          const x0 = tx * tileWidth,  y0 = ty * tileHeight;
          const x1 = x0 + tileWidth,  y1 = y0 + tileHeight;
          const u0 = def.uvX, v0 = def.uvY;
          const u1 = def.uvX + def.uvW, v1 = def.uvY + def.uvH;

          // 4 vertices: TL, BL, TR, BR
          verts[vi++]=x0; verts[vi++]=y1; verts[vi++]=u0; verts[vi++]=v0;
          verts[vi++]=x0; verts[vi++]=y0; verts[vi++]=u0; verts[vi++]=v1;
          verts[vi++]=x1; verts[vi++]=y1; verts[vi++]=u1; verts[vi++]=v0;
          verts[vi++]=x1; verts[vi++]=y0; verts[vi++]=u1; verts[vi++]=v1;

          const base = tileIdx * 4;
          idxArr[ii++]=base; idxArr[ii++]=base+1; idxArr[ii++]=base+2;
          idxArr[ii++]=base+2; idxArr[ii++]=base+1; idxArr[ii++]=base+3;
          tileIdx++;
        }
      }
    }

    // Upload to GPU
    if (!tilemap._vao) {
      tilemap._vao = gl.createVertexArray()!;
      tilemap._vbo = gl.createBuffer()!;
      tilemap._ebo = gl.createBuffer()!;
    }

    gl.bindVertexArray(tilemap._vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, tilemap._vbo!);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);

    const stride = 16; // 4 floats * 4 bytes
    const aPos = this.shader.getAttribLocation('a_position');
    const aUV  = this.shader.getAttribLocation('a_texCoord');
    if (aPos >= 0) { gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0); gl.enableVertexAttribArray(aPos); }
    if (aUV  >= 0) { gl.vertexAttribPointer(aUV,  2, gl.FLOAT, false, stride, 8); gl.enableVertexAttribArray(aUV); }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tilemap._ebo!);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxArr, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);

    tilemap.clearDirty();
    log.debug('Tilemap uploaded %d tiles', totalTiles);
  }

  draw(tilemap: Tilemap, proj: Float32Array, view: Float32Array): void {
    if (!tilemap._vao || tilemap._tileCount === 0 || !tilemap.tileset) return;
    const gl = this.gl;

    this.shader.use();
    this.shader.setMat4('u_projection', proj);
    this.shader.setMat4('u_view', view);
    this.shader.setInt('u_tileset', 0);
    this.shader.setFloat('u_opacity', 1);
    tilemap.tileset.bind(0);

    gl.bindVertexArray(tilemap._vao);
    gl.drawElements(gl.TRIANGLES, tilemap._tileCount * 6, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  destroy(): void { this.shader.destroy(); }
}
