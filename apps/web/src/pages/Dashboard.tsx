import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { DashboardDto } from '@vira/shared';
import { get } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { AreaChart, Donut } from '../components/charts.js';
import { ErrorState, StatusBadge, TrafficBar } from '../components/ui.js';

export default function Dashboard() {
  const { t, num, bytes, rel, locale } = useI18n();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<DashboardDto>('/dashboard'), refetchInterval: 30_000 });

  if (q.isLoading) return <div className="skel-rows"><div className="skeleton" style={{ height: 120 }} /><div className="skeleton" style={{ height: 300 }} /></div>;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const d = q.data;

  const stats = [
    { icon: 'users', tone: 'violet', label: t('dash.activeUsers'), value: num(d.stats.activeUsers) },
    { icon: 'config', tone: 'cyan', label: t('dash.activeConfigs'), value: num(d.stats.activeConfigs) },
    { icon: 'traffic', tone: 'green', label: t('dash.totalTraffic'), value: bytes(d.stats.totalTrafficBytes) },
    { icon: 'subscription', tone: 'violet', label: t('dash.activeSubs'), value: num(d.stats.activeSubscriptions) },
    { icon: 'server', tone: 'cyan', label: t('dash.onlineNodes'), value: `${num(d.stats.onlineNodes)} / ${num(d.stats.totalNodes)}` },
    { icon: 'clock', tone: 'amber', label: t('dash.expiringSoon'), value: num(d.stats.expiringSoon) },
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">👋 {t('dash.greeting')}</h1>
        <p className="page-sub">{t('dash.subtitle')}</p>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div className="card stat" key={s.label}>
            <span className={`stat-icon ${s.tone}`}><Icon name={s.icon} size={24} /></span>
            <div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <section className="card" aria-label={t('dash.trafficOverview')}>
          <div className="card-head">
            <div className="card-title"><Icon name="traffic" size={17} />{t('dash.trafficOverview')}</div>
            <span className="pill up">{t('dash.last7')}</span>
          </div>
          <AreaChart series={d.trafficSeries} />
        </section>

        <section className="card card-pad" aria-label={t('dash.nodeStatus')}>
          <div className="card-head" style={{ padding: 0, marginBottom: 12 }}>
            <div className="card-title"><Icon name="server" size={17} />{t('dash.nodeStatus')}</div>
            <Link className="card-link" to="/nodes">{t('common.viewAll')}</Link>
          </div>
          {d.nodes.map((n) => (
            <div className="node-card" key={n.id}>
              <div className="node-head">
                <span className={`node-dot ${n.status}`} />
                <div>
                  <b style={{ fontSize: 13 }}>{n.name}</b>
                  <div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{n.location} · {n.latencyMs !== null ? `${num(n.latencyMs)}ms` : '—'}</div>
                </div>
                <span style={{ marginInlineStart: 'auto' }}><StatusBadge status={n.status} /></span>
              </div>
              <div className="node-metrics">
                <div><div className="meter-label"><span>{t('dash.cpu')}</span><span>{num(n.metrics?.cpu ?? 0)}%</span></div><div className="progress"><span style={{ width: `${n.metrics?.cpu ?? 0}%` }} /></div></div>
                <div><div className="meter-label"><span>{t('dash.mem')}</span><span>{num(n.metrics?.memory ?? 0)}%</span></div><div className="progress"><span style={{ width: `${n.metrics?.memory ?? 0}%` }} /></div></div>
                <div><div className="meter-label"><span>{t('dash.traffic')}</span><span>{bytes((n.metrics?.trafficOut ?? 0) + (n.metrics?.trafficIn ?? 0))}</span></div><div className="progress"><span style={{ width: `${Math.min(100, ((n.metrics?.connections ?? 0) / 400) * 100)}%` }} /></div></div>
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="grid-3">
        <section className="card" aria-label={t('dash.recentUsers')}>
          <div className="card-head">
            <div className="card-title"><Icon name="users" size={17} />{t('dash.recentUsers')}</div>
            <Link className="card-link" to="/users">{t('common.viewAll')}</Link>
          </div>
          <div className="table-wrap">
            <table className="vt">
              <thead><tr><th>{t('common.username')}</th><th>{t('users.traffic')}</th><th>{t('common.status')}</th></tr></thead>
              <tbody>
                {d.recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td><Link to={`/users/${u.id}`} style={{ color: 'var(--secondary)' }}>{u.username}</Link></td>
                    <td><TrafficBar used={u.trafficUsedBytes} quota={u.trafficQuotaBytes} /></td>
                    <td><StatusBadge status={u.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card card-pad" aria-label={t('dash.recentActivity')}>
          <div className="card-head" style={{ padding: 0, marginBottom: 8 }}>
            <div className="card-title"><Icon name="activity" size={17} />{t('dash.recentActivity')}</div>
            <Link className="card-link" to="/activity">{t('common.viewAll')}</Link>
          </div>
          <div className="act-list">
            {d.recentActivity.map((a) => (
              <div className="act-row" key={a.id}>
                <span className={`act-icon ${a.result === 'success' ? 'green' : a.result === 'denied' ? 'red' : 'blue'}`}>
                  <Icon name={a.action.includes('LOGIN') ? 'user' : a.action.includes('NODE') ? 'server' : a.action.includes('CONFIG') ? 'config' : 'bolt'} size={14} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12 }}>{a.action.replaceAll('_', ' ').toLowerCase()}</div>
                  <small style={{ color: 'var(--muted-2)' }}>{a.actorName}</small>
                </div>
                <span className="act-time">{rel(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad" aria-label={t('dash.configStats')}>
          <div className="card-head" style={{ padding: 0, marginBottom: 4 }}>
            <div className="card-title"><Icon name="config" size={17} />{t('dash.configStats')}</div>
          </div>
          <Donut
            centerValue={num(d.configStats.reduce((a, b) => a + b.count, 0))}
            centerLabel={t('nav.configs')}
            data={d.configStats.map((c, i) => ({ label: c.protocol.toUpperCase(), value: c.count, color: ['#7c6cff', '#3ec6ff', '#2fd39a', '#f7b955'][i % 4] }))}
          />
          <div className="card-head" style={{ padding: '8px 0 4px' }}>
            <div className="card-title" style={{ fontSize: 12.5 }}><Icon name="subscription" size={15} />{t('dash.subStats')}</div>
          </div>
          <div className="legend">
            {d.subscriptionStats.map((s) => (
              <div className="legend-row" key={s.status}>
                <span className="legend-dot" style={{ background: s.status === 'active' ? 'var(--success)' : s.status === 'expired' ? 'var(--warning)' : 'var(--danger)' }} />
                {t(`common.${s.status}` as never)}
                <b>{num(s.count)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card card-pad" style={{ marginTop: 16 }} aria-label={t('dash.systemHealth')}>
        <div className="card-head" style={{ padding: 0, marginBottom: 12 }}>
          <div className="card-title"><Icon name="health" size={17} />{t('dash.systemHealth')}</div>
          <Link className="card-link" to="/health">{t('common.viewAll')}</Link>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {d.systemHealth.map((h) => (
            <div key={h.component} className="node-card" style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
              <span className={`node-dot ${h.status === 'healthy' ? 'online' : h.status === 'warning' ? 'degraded' : h.status === 'unknown' ? 'maintenance' : 'offline'}`} />
              <b style={{ fontSize: 12, textTransform: 'uppercase' }}>{h.component}</b>
              <span style={{ marginInlineStart: 'auto' }}><StatusBadge status={h.status} /></span>
            </div>
          ))}
        </div>
        {locale === 'fa' && <div style={{ height: 0 }} />}
      </section>
    </>
  );
}
