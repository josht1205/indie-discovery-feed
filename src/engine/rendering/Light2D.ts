// Light2D — component for 2D point/directional/ambient lights
import { Component } from '../ecs/Component';

export type LightType = 'point' | 'directional' | 'ambient';

export class Light2D extends Component {
  static readonly TYPE = 'Light2D';

  lightType:  LightType = 'point';

  // Color [0..1]
  r = 1; g = 0.9; b = 0.7;

  intensity   = 1.5;
  radius      = 300;    // world units (point light)
  z           = 100;    // height above 2D plane (for normal map shading)

  // Attenuation shape: 0=linear, 1=quadratic (inverse-square)
  attenuationMode = 1;

  // Shadow casting (future: soft shadow maps)
  castShadows  = false;

  // Pulse / flicker
  flickerAmount = 0;        // 0 = stable, 0.1 = slight flicker
  flickerSpeed  = 8;

  // Computed flicker offset (updated by LightingSystem)
  _flickerOffset = 0;

  enabled = true;
}
