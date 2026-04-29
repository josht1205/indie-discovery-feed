/**
 * Thin HTTP client to the UnrealMCP plugin running inside the UE5 editor.
 *
 * The plugin always responds with `{ success, result, error }`. We unwrap that
 * envelope here so tool implementations can treat results as plain values, and
 * errors propagate as thrown exceptions with descriptive messages.
 */

const DEFAULT_BASE_URL =
  process.env.UNREAL_MCP_URL ?? "http://127.0.0.1:9877";
const DEFAULT_TIMEOUT_MS = Number(process.env.UNREAL_MCP_TIMEOUT_MS ?? 15000);

export interface UE5Envelope<T = unknown> {
  success: boolean;
  result: T | null;
  error: string | null;
}

export class UE5ConnectionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "UE5ConnectionError";
  }
}

export class UE5HandlerError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "UE5HandlerError";
  }
}

export interface UE5ClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class UE5Client {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: UE5ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get(endpoint: string, body?: unknown): Promise<unknown> {
    return this.request("GET", endpoint, body);
  }

  post(endpoint: string, body?: unknown): Promise<unknown> {
    return this.request("POST", endpoint, body);
  }

  async health(): Promise<boolean> {
    try {
      await this.get("/health");
      return true;
    } catch {
      return false;
    }
  }

  private async request(
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        signal: ac.signal,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new UE5ConnectionError(
        `Could not reach Unreal editor at ${this.baseUrl}. Is the editor running with the UnrealMCP plugin enabled? (${msg})`,
        err,
      );
    } finally {
      clearTimeout(timer);
    }

    let parsed: UE5Envelope;
    try {
      parsed = (await res.json()) as UE5Envelope;
    } catch (err) {
      throw new UE5HandlerError(
        `Unreal editor returned non-JSON response (status ${res.status})`,
        res.status,
      );
    }

    if (!res.ok || !parsed.success) {
      throw new UE5HandlerError(
        parsed.error ?? `HTTP ${res.status}`,
        res.status,
      );
    }
    return parsed.result;
  }
}

let singleton: UE5Client | undefined;
export function getClient(): UE5Client {
  if (!singleton) singleton = new UE5Client();
  return singleton;
}
