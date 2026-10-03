import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { ErrorState, SkelRows, StatusBadge, TrafficBar, CopyBtn } from '../components/ui.js';

interface Detail {
  user: { id: string; username: string; displayName: string; status: string; trafficQuotaBytes: number; trafficUsedBytes: number; expireAt: string | null; tags: string[]; notes: string; createdAt: string; lastActiveAt: string | null; online: boolean };
  subscriptions: { id: string; status: string; expiresAt: string | null; trafficQuotaBytes: number; trafficUsedBytes: number; token: string; createdAt: string }[];
  configCount: number;
  activity: { id: string; action: string; result: string; createdAt: string; actorName: string }[];
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, num, bytes, date, rel } = useI18n();
  const [tab, setTab] = useState<'overview' | 'subscriptions' | 'activity'>('overview');
  const q = useQuery({ queryKey: ['user', id], queryFn: () => get<Detail>(`/users/${id}`) });

  if (q.isLoading) return <SkelRows />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const u = q.data.user;

  const tabs = [
    { id: 'overview', label: t('users.overview') },
    { id: 'subscriptions', label: t('users.subscriptions') },
    { id: 'activity', label: t('users.activity') },
  ] as const;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/users" className="btn ghost sm">←</Link>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            {u.online && <span className="node-dot online" />} {u.displayName}
          </h1>
          <p className="page-sub" style={{ margin: '2px 0 0' }}>{u.username} · {date(u.createdAt)}</p>
        </div>
        <span style={{ marginInlineStart: 'auto' }}><StatusBadge status={u.status} /></span>
      </div>

      <div className="toolbar" style={{ borderBottom: '1px solid var(--border)', borderRadius: 0, marginBottom: 18 }}>
        {tabs.map((x) => (
          <button key={x.id} className={`btn ghost sm`} style={tab === x.id ? { background: 'var(--primary-soft)', color: 'var(--text)' } : undefined} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid-3">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 12 }}><Icon name="traffic" size={16} />{t('users.traffic')}</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{bytes(u.trafficUsedBytes)}</div>
            <div style={{ color: 'var(--muted-2)', fontSize: 11, margin: '4px 0 12px' }}>{t('common.of')} {bytes(u.trafficQuotaBytes)}</div>
            <TrafficBar used={u.trafficUsedBytes} quota={u.trafficQuotaBytes} />
          </div>
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 12 }}><Icon name="clock" size={16} />{t('users.expire')}</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{date(u.expireAt)}</div>
            <div style={{ color: 'var(--muted-2)', fontSize: 11, marginTop: 4 }}>{t('users.lastActive')}: {rel(u.lastActiveAt)}</div>
          </div>
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 12 }}><Icon name="group" size={16} />{t('users.tags')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {u.tags.map((tag) => <span key={tag} className="badge violet">{tag}</span>)}
              {u.tags.length === 0 && <span style={{ color: 'var(--muted-2)', fontSize: 12 }}>—</span>}
            </div>
            {u.notes && <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>{u.notes}</p>}
            <div style={{ marginTop: 12, color: 'var(--muted-2)', fontSize: 11.5 }}>{num(q.data.configCount)} {t('users.configs')}</div>
          </div>
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="card">
          {q.data.subscriptions.length === 0 ? <div className="empty"><Icon name="subscription" size={30} /><span>{t('common.empty')}</span></div> : (
            <div className="table-wrap">
              <table className="vt">
                <thead><tr><th>{t('subs.token')}</th><th>{t('users.traffic')}</th><th>{t('users.expire')}</th><th>{t('common.status')}</th><th /></tr></thead>
                <tbody>
                  {q.data.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.token.slice(0, 10)}…</td>
                      <td><TrafficBar used={s.trafficUsedBytes} quota={s.trafficQuotaBytes} /></td>
                      <td style={{ color: 'var(--muted)' }}>{date(s.expiresAt)}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td><CopyBtn text={`${location.origin}/sub/${s.token}`} label={t('sub.subUrl')} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card card-pad">
          <div className="act-list">
            {q.data.activity.map((a) => (
              <div className="act-row" key={a.id}>
                <span className={`act-icon ${a.result === 'success' ? 'green' : 'red'}`}><Icon name="bolt" size={14} /></span>
                <div><div style={{ fontSize: 12 }}>{a.action.replaceAll('_', ' ').toLowerCase()}</div><small style={{ color: 'var(--muted-2)' }}>{a.actorName}</small></div>
                <span className="act-time">{rel(a.createdAt)}</span>
              </div>
            ))}
            {q.data.activity.length === 0 && <div className="empty">{t('common.empty')}</div>}
          </div>
        </div>
      )}
    </>
  );
}
