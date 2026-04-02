// SpriteComponent — holds a texture reference and rendering properties for an entity
import { Component } from '../ecs/Component';
import { Texture } from './Texture';

export class SpriteComponent extends Component {
  static readonly TYPE = 'SpriteComponent';

  texture:  Texture | null = null;

  // Tint color [0..1]
  r = 1; g = 1; b = 1; a = 1;

  // UV sub-rect within an atlas texture [0..1]
  uvX = 0; uvY = 0; uvW = 1; uvH = 1;

  // Size in world units (defaults to texture pixel dimensions / PPU)
  width  = 1;
  height = 1;

  // Pivot offset [0..1] — 0.5,0.5 = center
  pivotX = 0.5;
  pivotY = 0.5;

  // Sorting layer / z-order
  layer = 0;

  flipX = false;
  flipY = false;

  setTint(r: number, g: number, b: number, a = 1): void {
    this.r = r; this.g = g; this.b = b; this.a = a;
  }

  setUVRect(x: number, y: number, w: number, h: number): void {
    this.uvX = x; this.uvY = y; this.uvW = w; this.uvH = h;
  }
}
