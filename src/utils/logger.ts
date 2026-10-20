import { appConfig } from '../config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: number;
  private sensitivePatterns = [
    /Bearer\s+[^\s]+/gi,
    /api[_-]?key[=:]\s*[^\s]+/gi,
    /token[=:]\s*[^\s]+/gi,
    /secret[=:]\s*[^\s]+/gi,
    /lyr_[a-zA-Z0-9_-]+/gi,
  ];

  constructor() {
    const levelStr = (appConfig.logLevel || 'info') as LogLevel;
    this.level = LOG_LEVELS[levelStr] || LOG_LEVELS.info;
  }

  private redact(message: string): string {
    let redacted = message;
    for (const pattern of this.sensitivePatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  private redactObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.redact(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }
    if (obj && typeof obj === 'object') {
      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('authorization')
        ) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = this.redactObject(value);
        }
      }
      return redacted;
    }
    return obj;
  }

  private log(level: LogLevel, message: string, meta?: any) {
    if (LOG_LEVELS[level] < this.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const redactedMessage = this.redact(message);
    const redactedMeta = meta ? this.redactObject(meta) : undefined;

    const logEntry = {
      timestamp,
      level,
      message: redactedMessage,
      ...(redactedMeta && { meta: redactedMeta }),
    };

    const output = JSON.stringify(logEntry);

    // Always stderr: stdout is the protocol channel in stdio mode.
    console.error(output);
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }
}

export const logger = new Logger();
