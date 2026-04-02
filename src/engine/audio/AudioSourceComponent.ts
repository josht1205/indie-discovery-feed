// AudioSourceComponent — attaches a sound to an entity for spatial playback
import { Component }     from '../ecs/Component';
import { AudioSourceOptions, PlayHandle } from './AudioEngine';

export class AudioSourceComponent extends Component {
  static readonly TYPE = 'AudioSourceComponent';

  /** URL of the audio asset */
  url = '';

  /** If true, starts playing when the component is attached */
  playOnAwake = false;

  channel: 'music' | 'sfx' = 'sfx';

  options: AudioSourceOptions = {
    loop:         false,
    volume:       1,
    pitch:        1,
    spatial:      false,
    refDistance:  50,
    maxDistance:  500,
    rolloffFactor: 1,
    panningModel:  'HRTF',
    distanceModel: 'inverse',
  };

  // Runtime handle (set by AudioSystem)
  handle: PlayHandle | null = null;
  isPlaying = false;

  play():  void { this.isPlaying = true; }
  stop():  void { this.isPlaying = false; this.handle?.stop(); this.handle = null; }
  pause(): void { /* handled by AudioSystem via suspend */ }
}
