// AssetLoader — centralised async asset loading with progress tracking and caching
import { createLogger } from '../core/Logger';

const log = createLogger('AssetLoader');

export type AssetType = 'image' | 'audio' | 'json' | 'text' | 'binary';

export interface AssetEntry {
  key:  string;
  url:  string;
  type: AssetType;
}

export interface LoadProgress {
  loaded: number;
  total:  number;
  key:    string;
}

export class AssetLoader {
  private cache = new Map<string, unknown>();
  private loading = new Map<string, Promise<unknown>>();

  onProgress?: (p: LoadProgress) => void;

  /** Pre-load a batch of assets */
  async loadAll(assets: AssetEntry[]): Promise<void> {
    let loaded = 0;
    await Promise.all(assets.map(async (entry) => {
      await this.load(entry);
      loaded++;
      this.onProgress?.({ loaded, total: assets.length, key: entry.key });
    }));
    log.info('Loaded %d assets', assets.length);
  }

  /** Load a single asset, returning from cache if already loaded */
  async load<T = unknown>(entry: AssetEntry): Promise<T> {
    if (this.cache.has(entry.key)) return this.cache.get(entry.key) as T;
    if (this.loading.has(entry.key)) return this.loading.get(entry.key) as Promise<T>;

    const promise = this._fetch(entry).then((data) => {
      this.cache.set(entry.key, data);
      this.loading.delete(entry.key);
      return data;
    });
    this.loading.set(entry.key, promise);
    return promise as Promise<T>;
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  has(key: string): boolean { return this.cache.has(key); }

  unload(key: string): void { this.cache.delete(key); }

  clear(): void { this.cache.clear(); }

  private async _fetch(entry: AssetEntry): Promise<unknown> {
    switch (entry.type) {
      case 'image': {
        return new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = entry.url;
        });
      }
      case 'audio': {
        const resp = await fetch(entry.url);
        return resp.arrayBuffer();
      }
      case 'json': {
        const resp = await fetch(entry.url);
        return resp.json();
      }
      case 'text': {
        const resp = await fetch(entry.url);
        return resp.text();
      }
      case 'binary': {
        const resp = await fetch(entry.url);
        return resp.arrayBuffer();
      }
    }
  }
}

export const globalAssets = new AssetLoader();
