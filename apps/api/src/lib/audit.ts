import { db, auditLogs, notifications } from '@vira/db';
import type { FastifyRequest } from 'fastify';

interface AuditInput {
  actorId?: string | null;
  actorName?: string;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  result?: 'success' | 'denied' | 'error';
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget audit writer; never breaks the request path. */
export function audit(req: FastifyRequest | null, input: AuditInput): void {
  const ip = req ? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip : '';
  const userAgent = req ? String(req.headers['user-agent'] ?? '') : '';
  db.insert(auditLogs)
    .values({
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? (req ? 'anonymous' : 'system'),
      action: input.action,
      resourceType: input.resourceType ?? '',
      resourceId: input.resourceId ?? null,
      result: input.result ?? 'success',
      ip,
      userAgent,
      metadata: input.metadata ?? {},
    })
    .catch((err) => req?.log?.error({ err }, 'audit write failed'));
}

export async function notify(type: string, title: string, body = '', accountId: string | null = null): Promise<void> {
  await db.insert(notifications).values({ type, title, body, accountId }).catch(() => {});
}
