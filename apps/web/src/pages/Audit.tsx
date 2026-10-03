import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditDto, Paginated } from '@vira/shared';
import { get } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Empty, ErrorState, Pager, SkelRows, StatusBadge } from '../components/ui.js';

export function AuditTable({ extra = '' }: { extra?: string }) {
  const { t, rel } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const q = useQuery({
    queryKey: ['audit', page, search, result, extra],
    queryFn: () => get<Paginated<AuditDto & { metadata: unknown }>>(`/audit?page=${page}&search=${encodeURIComponent(search)}${result ? `&result=${result}` : ''}${extra}`),
    placeholderData: (p) => p,
  });

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 240 }} placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="select" style={{ maxWidth: 140 }} value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }} aria-label={t('audit.result')}>
          <option value="">{t('audit.result')}</option>
          <option value="success">success</option><option value="denied">denied</option><option value="error">error</option>
        </select>
      </div>
      <div className="card">
        {q.isLoading && <SkelRows />}
        {q.isError && <ErrorState onRetry={() => q.refetch()} />}
        {q.data && q.data.items.length === 0 && <Empty icon="audit" />}
        {q.data && q.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="vt">
              <thead><tr><th>{t('audit.action')}</th><th>{t('audit.actor')}</th><th>{t('audit.ip')}</th><th>{t('audit.result')}</th><th>When</th></tr></thead>
              <tbody>
                {q.data.items.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.action}</td>
                    <td>{a.actorName}</td>
                    <td style={{ color: 'var(--muted-2)', fontSize: 11 }}>{a.ip || '—'}</td>
                    <td><StatusBadge status={a.result} /></td>
                    <td style={{ color: 'var(--muted-2)', fontSize: 11 }}>{rel(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} />
          </div>
        )}
      </div>
    </>
  );
}

export default function Audit() {
  const { t } = useI18n();
  return (
    <>
      <h1 className="page-title">{t('audit.title')}</h1>
      <p className="page-sub"> </p>
      <AuditTable />
    </>
  );
}
