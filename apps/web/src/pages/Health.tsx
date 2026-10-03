import { useQuery } from '@tanstack/react-query';
import type { DashboardDto } from '@vira/shared';
import { get } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { ErrorState, SkelRows, StatusBadge } from '../components/ui.js';

export default function Health() {
  const { t, num } = useI18n();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<DashboardDto>('/dashboard'), refetchInterval: 15_000 });
  const ready = useQuery({ queryKey: ['ready'], queryFn: () => get<{ status: string; checks: Record<string, string> }>('/ready'), refetchInterval: 15_000 });

  if (q.isLoading) return <SkelRows />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <>
      <h1 className="page-title">{t('health.title')}</h1>
      <p className="page-sub"> </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {q.data.systemHealth.map((h) => (
          <div className="card card-pad" key={h.component}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`stat-icon ${h.status === 'healthy' ? 'green' : h.status === 'warning' ? 'amber' : 'violet'}`} style={{ width: 40, height: 40 }}>
                <Icon name={h.component === 'database' ? 'docs' : h.component === 'redis' ? 'bolt' : h.component === 'worker' ? 'activity' : h.component === 'nodes' ? 'server' : 'health'} size={18} />
              </span>
              <b style={{ textTransform: 'uppercase', fontSize: 13 }}>{h.component}</b>
              <span style={{ marginInlineStart: 'auto' }}><StatusBadge status={h.status} /></span>
            </div>
            <div style={{ color: 'var(--muted-2)', fontSize: 11, marginTop: 10 }}>
              {h.latencyMs !== null ? `${num(h.latencyMs)}ms` : ready.data?.checks?.[h.component] ?? '—'}
            </div>
          </div>
        ))}
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="stat-icon cyan" style={{ width: 40, height: 40 }}><Icon name="server" size={18} /></span>
            <b style={{ fontSize: 13 }}>{t('nav.nodes')}</b>
            <span style={{ marginInlineStart: 'auto' }}>
              <StatusBadge status={q.data.stats.onlineNodes === q.data.stats.totalNodes ? 'healthy' : 'warning'} />
            </span>
          </div>
          <div style={{ color: 'var(--muted-2)', fontSize: 11, marginTop: 10 }}>
            {num(q.data.stats.onlineNodes)} / {num(q.data.stats.totalNodes)} {t('common.online')}
          </div>
        </div>
      </div>
    </>
  );
}
