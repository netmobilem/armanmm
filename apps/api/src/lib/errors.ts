import type { FastifyReply } from 'fastify';
import type { ApiErrorCode } from '@vira/shared';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  static notFound(msg = 'Resource not found'): ApiError { return new ApiError('RESOURCE_NOT_FOUND', msg, 404); }
  static forbidden(msg = 'Forbidden'): ApiError { return new ApiError('FORBIDDEN', msg, 403); }
  static unauthorized(msg = 'Authentication required'): ApiError { return new ApiError('UNAUTHORIZED', msg, 401); }
  static conflict(msg: string): ApiError { return new ApiError('CONFLICT', msg, 409); }
}

export function sendError(reply: FastifyReply, err: unknown, requestId: string): void {
  if (err instanceof ApiError) {
    reply.status(err.status).send({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
      requestId,
    });
    return;
  }
  const anyErr = err as { statusCode?: number; code?: string; message?: string };
  if (anyErr?.statusCode === 429) {
    reply.status(429).send({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' }, requestId });
    return;
  }
  reply.log?.error({ err }, 'unhandled error');
  reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    requestId,
  });
}
