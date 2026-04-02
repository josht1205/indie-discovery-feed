// AudioEngine — Web Audio API wrapper with 3D spatial audio support
// Implements: AudioContext management, gain hierarchy, HRTF panner, reverb
import { Vec3 } from '../math/Vec3';
import { createLogger } from '../core/Logger';

const log = createLogger('AudioEngine');

export interface AudioSourceOptions {
  loop?:       boolean;
  volume?:     number;
  pitch?:      number;   // playback rate multiplier
  spatial?:    boolean;  // use 3D panning
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  panningModel?: PanningModelType;   // 'HRTF' | 'equalpower'
  distanceModel?: DistanceModelType; // 'linear' | 'inverse' | 'exponential'
}

export interface PlayHandle {
  source:  AudioBufferSourceNode;
  gain:    GainNode;
  panner?: PannerNode;
  stop():  void;
  setVolume(v: number): void;
  setPitch(p: number):  void;
  setPosition(x: number, y: number, z: number): void;
}

export class AudioEngine {
  private ctx!: AudioContext;
  private masterGain!: GainNode;
  private musicGain!:  GainNode;
  private sfxGain!:    GainNode;
  private reverbNode?: ConvolverNode;

  private bufferCache = new Map<string, AudioBuffer>();
  private activeSources = new Set<PlayHandle>();

  private _listenerPos: Vec3 = Vec3.zero();
  private _listenerFwd: Vec3 = Vec3.forward();
  private _listenerUp:  Vec3 = Vec3.up();

  private _initialized = false;

  /** Must be called from a user gesture (click/keydown) */
  async init(): Promise<void> {
    if (this._initialized) return;
    this.ctx = new AudioContext();

    // Gain hierarchy: master → sfx / music
    this.masterGain = this.ctx.createGain();
    this.musicGain  = this.ctx.createGain();
    this.sfxGain    = this.ctx.createGain();

    this.masterGain.connect(this.ctx.destination);
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);

    this._initialized = true;
    log.info('AudioEngine initialized (sampleRate=%dHz)', this.ctx.sampleRate);
  }

  get initialized() { return this._initialized; }

  setMasterVolume(v: number): void { this.masterGain?.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01); }
  setMusicVolume (v: number): void { this.musicGain?.gain.setTargetAtTime(v,  this.ctx.currentTime, 0.01); }
  setSFXVolume   (v: number): void { this.sfxGain?.gain.setTargetAtTime(v,    this.ctx.currentTime, 0.01); }

  /** Load and decode an audio file, returning cached buffer */
  async loadBuffer(url: string): Promise<AudioBuffer> {
    if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
    const resp   = await fetch(url);
    const data   = await resp.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(data);
    this.bufferCache.set(url, buffer);
    log.debug('Audio buffer loaded: %s (%.2fs)', url, buffer.duration);
    return buffer;
  }

  /**
   * Play a loaded buffer.
   * @param buffer  decoded AudioBuffer
   * @param channel 'music' | 'sfx' — routes to the correct gain bus
   * @param opts    playback options
   */
  play(buffer: AudioBuffer, channel: 'music' | 'sfx' = 'sfx', opts: AudioSourceOptions = {}): PlayHandle {
    if (!this._initialized) throw new Error('Call AudioEngine.init() before playing sounds');

    const source = this.ctx.createBufferSource();
    source.buffer       = buffer;
    source.loop         = opts.loop    ?? false;
    source.playbackRate.value = opts.pitch ?? 1;

    const gain = this.ctx.createGain();
    gain.gain.value = opts.volume ?? 1;

    const bus = channel === 'music' ? this.musicGain : this.sfxGain;

    let panner: PannerNode | undefined;
    if (opts.spatial) {
      panner = this.ctx.createPanner();
      panner.panningModel  = opts.panningModel   ?? 'HRTF';
      panner.distanceModel = opts.distanceModel  ?? 'inverse';
      panner.refDistance   = opts.refDistance    ?? 1;
      panner.maxDistance   = opts.maxDistance    ?? 1000;
      panner.rolloffFactor = opts.rolloffFactor  ?? 1;
      source.connect(gain);
      gain.connect(panner);
      panner.connect(bus);
    } else {
      source.connect(gain);
      gain.connect(bus);
    }

    source.start();

    const handle: PlayHandle = {
      source, gain, panner,
      stop() { try { source.stop(); } catch { /* ignore */ } },
      setVolume(v: number) { gain.gain.setTargetAtTime(v, this.source.context.currentTime, 0.01); },
      setPitch(p: number)  { source.playbackRate.value = p; },
      setPosition(x: number, y: number, z: number) {
        if (panner) panner.positionX.value = x, panner.positionY.value = y, panner.positionZ.value = z;
      },
    };

    source.onended = () => { this.activeSources.delete(handle); };
    this.activeSources.add(handle);
    return handle;
  }

  /** Update the 3D listener position/orientation (call each frame) */
  setListenerTransform(pos: Vec3, forward: Vec3, up: Vec3): void {
    if (!this._initialized) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = pos.y;
      l.positionZ.value = pos.z;
      l.forwardX.value  = forward.x;
      l.forwardY.value  = forward.y;
      l.forwardZ.value  = forward.z;
      l.upX.value       = up.x;
      l.upY.value       = up.y;
      l.upZ.value       = up.z;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /** Create and apply a simple reverb room impulse (using shaped noise) */
  async createReverb(duration = 2, decay = 2, reverse = false): Promise<void> {
    const rate    = this.ctx.sampleRate;
    const length  = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const t = reverse ? length - i : i;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / length, decay);
      }
    }
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = impulse;
    this.reverbNode.connect(this.masterGain);
    log.debug('Reverb impulse created (%.1fs, decay=%.1f)', duration, decay);
  }

  stopAll(): void {
    this.activeSources.forEach((h) => h.stop());
    this.activeSources.clear();
  }

  suspend(): void { this.ctx?.suspend(); }
  resume():  void { this.ctx?.resume(); }

  get currentTime(): number { return this.ctx?.currentTime ?? 0; }
}
