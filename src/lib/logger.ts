export const LGPD_REDACTED = '[LGPD_REDACTED]' as const;

const SENSITIVE_KEYS = new Set<string>([
  'password',
  'passwordhash',
  'password_hash',
  'cardnumber',
  'card_number',
  'email',
  'buyeremail',
  'buyer_email',
  'apikey',
  'api_key',
  'x-api-key',
  'token',
  'sessionid',
  'session_id',
  'authorization',
  'cookie',
]);

export type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (SENSITIVE_KEYS.has(normalized)) {
    return true;
  }
  return (
    normalized.includes('password') ||
    normalized.includes('cardnumber') ||
    normalized.includes('card_number') ||
    normalized.includes('apikey') ||
    normalized.includes('api_key')
  );
}

/**
 * Recursively redacts LGPD-sensitive fields (PII, credentials, payment card numbers, tokens)
 * from structured log payloads, replacing their values with `[LGPD_REDACTED]`.
 */
export function redactLogData(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);
    return value.map((item) => redactLogData(item, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input)) {
      if (isSensitiveKey(key)) {
        output[key] = LGPD_REDACTED;
      } else {
        output[key] = redactLogData(val, seen);
      }
    }
    return output;
  }
  return value;
}

/**
 * Formats a structured JSON log line with automatic LGPD redaction applied to metadata.
 */
export function formatLogEntry(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (meta && Object.keys(meta).length > 0) {
    entry.meta = redactLogData(meta) as Record<string, unknown>;
  }
  return JSON.stringify(entry);
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = formatLogEntry(level, message, meta);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Application-wide structured JSON logger with mandatory LGPD PII/card redaction.
 */
export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    writeLog('info', message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    writeLog('warn', message, meta);
  },
  error(message: string, meta?: Record<string, unknown>): void {
    writeLog('error', message, meta);
  },
};
