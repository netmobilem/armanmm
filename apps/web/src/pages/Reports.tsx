import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { ErrorState, SkelRows } from '../components/ui.js';

type ReportKey = 'traffic' | 'users' | 'subscriptions' | 'nodes' | 'configs';

export default function Reports() {
  const { t, num, bytes } = useI18n();
  const [kind, setKind] = useState<ReportKey>('traffic');
  const [from, setFrom] = useState(() => new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ['report', kind, from, to],
    queryFn: () => get<Record<string, string | number>[]>(`/reports/${kind}?from=${from}T00:00:00Z&to=${to}T23:59:59Z`),
  });

  const exportCsv = () => {
    window.open(`/api/v1/reports/${kind}?from=${from}T00:00:00Z&to=${to}T23:59:59Z&format=csv`, '_blank');
  };

  const rows = q.data ?? [];
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <>
      <h1 className="page-title">{t('reports.title')}</h1>
      <p className="page-sub"> </p>
      <div className="toolbar">
        <select className="select" style={{ maxWidth: 180 }} value={kind} onChange={(e) => setKind(e.target.value as ReportKey)} aria-label="report type">
          <option value="traffic">{t('reports.traffic')}</option>
          <option value="users">{t('reports.users')}</option>
          <option value="subscriptions">{t('reports.subscriptions')}</option>
          <option value="nodes">{t('reports.nodes')}</option>
          <option value="configs">{t('reports.configs')}</option>
        </select>
        {kind === 'traffic' && (
          <>
            <input className="input" style={{ maxWidth: 160 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('reports.from')} />
            <input className="input" style={{ maxWidth: 160 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('reports.to')} />
          </>
        )}
        <div className="spacer" />
        <button className="btn secondary" onClick={exportCsv}><Icon name="download" size={15} />{t('reports.exportCsv')}</button>
      </div>

      <div className="card">
        {q.isLoading && <SkelRows />}
        {q.isError && <ErrorState onRetry={() => q.refetch()} />}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="vt">
              <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {cols.map((c) => (
                      <td key={c}>{typeof r[c] === 'number' && String(c).toLowerCase().includes('bytes') ? bytes(Number(r[c])) : num(Number(r[c])) || String(r[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length === 0 && !q.isLoading && !q.isError && <div className="empty">{t('common.empty')}</div>}
      </div>
    </>
  );
}
