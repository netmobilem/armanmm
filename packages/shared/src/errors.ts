export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'ACCOUNT_LOCKED',
  'INVALID_CREDENTIALS',
  'SESSION_EXPIRED',
  'CSRF_INVALID',
  'NODE_UNREACHABLE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  success: false;
  error: { code: ApiErrorCode; message: string; details?: unknown };
  requestId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
