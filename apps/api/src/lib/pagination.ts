import type { FastifyRequest } from 'fastify';

export interface PageQuery {
  page: number;
  pageSize: number;
  search: string;
  sort: string;
  dir: 'asc' | 'desc';
}

export function parsePage(request: FastifyRequest): PageQuery {
  const q = request.query as Record<string, string | undefined>;
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20) || 20));
  return {
    page,
    pageSize,
    search: (q.search ?? '').trim(),
    sort: (q.sort ?? 'createdAt').trim(),
    dir: q.dir === 'asc' ? 'asc' : 'desc',
  };
}

export function paginated<T>(items: T[], total: number, q: PageQuery) {
  return {
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}
