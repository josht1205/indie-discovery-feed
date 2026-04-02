// Logger — structured debug/warn/error output with category filtering
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

const COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '#888',
  [LogLevel.INFO]: '#4fc3f7',
  [LogLevel.WARN]: '#ffb74d',
  [LogLevel.ERROR]: '#ef5350',
  [LogLevel.NONE]: '',
};

export class Logger {
  private category: string;
  static globalLevel: LogLevel = LogLevel.DEBUG;

  constructor(category: string) {
    this.category = category;
  }

  private log(level: LogLevel, msg: string, ...args: unknown[]): void {
    if (level < Logger.globalLevel) return;
    const label = LogLevel[level].padEnd(5);
    const color = COLORS[level];
    const prefix = `%c[${label}] [${this.category}]`;
    console.log(prefix, `color:${color}`, msg, ...args);
  }

  debug(msg: string, ...args: unknown[]): void { this.log(LogLevel.DEBUG, msg, ...args); }
  info(msg: string, ...args: unknown[]): void  { this.log(LogLevel.INFO,  msg, ...args); }
  warn(msg: string, ...args: unknown[]): void  { this.log(LogLevel.WARN,  msg, ...args); }
  error(msg: string, ...args: unknown[]): void { this.log(LogLevel.ERROR, msg, ...args); }
}

export function createLogger(category: string): Logger {
  return new Logger(category);
}
