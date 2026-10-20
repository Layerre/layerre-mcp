import { createHash } from 'node:crypto';
import { logger } from '../utils/logger.js';

export interface AuditLogEntry {
  timestamp: string;
  userId: string;
  toolName: string;
  authType?: string;
  clientId?: string;
  success: boolean;
  durationMs: number;
  statusCode?: number;
  errorMessage?: string;
  payloadHash?: string;
}

/**
 * Audit entries are emitted as structured log lines (ship them to your log
 * pipeline). Nothing is retained in process memory.
 */
class AuditLogger {
  logToolCall(entry: AuditLogEntry) {
    logger.info('audit.tool_call', { ...entry });
  }
}

export const auditLogger = new AuditLogger();

export function createPayloadHash(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload ?? null))
    .digest('hex')
    .substring(0, 16);
}
