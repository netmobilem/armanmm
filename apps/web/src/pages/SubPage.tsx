import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-qr-code';
import { get } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon, Logo } from '../components/icons.js';
import { CopyBtn, ErrorState, Modal, SkelRows, StatusBadge, useToast } from '../components/ui.js';
import { BRAND } from '@vira/shared';

interface SubData {
  username: string; active: boolean; status: string; expiresAt: string | null; daysLeft: number | null;
  trafficQuotaBytes: number; trafficUsedBytes: number; subUrl: string;
  configs: { id: string; name: string; protocol: string; transport: string; security: string; nodeName: string; location: string; link: string | null }[];
}

export default function SubPage() {
  const { token } = useParams<{ token: string }>();
  const { t, num, bytes, date } = useI18n();
  const toast = useToast();
  const [qr, setQr] = useState<{ name: string; link: string } | null>(null);
  const q = useQuery({ queryKey: ['sub', token], queryFn: () => get<SubData>(`/public/sub/${token}`) });

  if (q.isLoading) return <div className="subpage"><SkelRows /></div>;
  if (q.isError || !q.data) return <div className="subpage"><div className="card"><ErrorState onRetry={() => q.refetch()} /></div></div>;
  const d = q.data;
  const pct = d.trafficQuotaBytes > 0 ? Math.min(100, Math.round((d.trafficUsedBytes / d.trafficQuotaBytes) * 100)) : 0;

  const copyAll = async () => {
    const links = d.configs.map((c) => c.link).filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(links); } catch { /* noop */ }
    toast(t('common.copied'));
  };

  return (
    <div className="subpage">
      <div className="sub-header">
        <div className="login-logo"><Logo size={28} /></div>
        <h1 style={{ margin: '0 0 2px', fontSize: 18 }}>{d.username}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>{BRAND.name} · {t('sub.pageTitle')}</p>
      </div>

      {!d.active && <div className="card card-pad" style={{ borderColor: 'rgba(255,84,112,.4)', marginBottom: 14, color: 'var(--danger)', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="warn" size={16} />{t('sub.inactive')}</div>}

      <div className="card sub-usage" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{t('users.traffic')}</span>
          <StatusBadge status={d.status} />
        </div>
        <div className="stat-value" style={{ fontSize: 22 }}>{bytes(d.trafficUsedBytes)} <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>{t('common.of')} {d.trafficQuotaBytes > 0 ? bytes(d.trafficQuotaBytes) : '∞'}</span></div>
        <div className="progress" style={{ margin: '12px 0 4px', height: 9 }}><span style={{ width: `${pct}%`, background: pct > 90 ? 'var(--danger)' : undefined }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-2)', fontSize: 10.5, marginTop: 8 }}>
          <span>{t('common.remaining')}: {d.trafficQuotaBytes > 0 ? bytes(Math.max(0, d.trafficQuotaBytes - d.trafficUsedBytes)) : '∞'}</span>
          <span>{d.daysLeft !== null ? `${num(d.daysLeft)} ${t('common.days')} ${t('common.left')}` : '∞'}</span>
        </div>
        <div style={{ color: 'var(--muted-2)', fontSize: 10.5, marginTop: 6 }}>{t('users.expire')}: {date(d.expiresAt)}</div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 10 }}><Icon name="link" size={16} />{t('sub.subUrl')}</div>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 10, direction: 'ltr', textAlign: 'left', wordBreak: 'break-all', margin: 0 }}>{location.origin}{d.subUrl}</pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <CopyBtn text={`${location.origin}${d.subUrl}`} />
          <button className="btn secondary sm" onClick={copyAll}><Icon name="copy" size={14} />{t('sub.copyAll')}</button>
        </div>
      </div>

      <h2 style={{ fontSize: 14, margin: '18px 0 10px' }}>{t('nav.configs')}</h2>
      {d.configs.map((c) => (
        <div className="config-item" key={c.id}>
          <span className="proto">{c.protocol.slice(0, 3).toUpperCase()}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 12.5 }}>{c.name}</b>
            <div style={{ color: 'var(--muted-2)', fontSize: 10.5 }}>{c.nodeName} · {c.transport} · {c.security}</div>
          </div>
          {c.link && (
            <>
              <button className="icon-btn" onClick={() => setQr({ name: c.name, link: c.link ?? '' })} aria-label={t('sub.qr')}><Icon name="qr" size={16} /></button>
              <CopyBtn text={c.link} />
            </>
          )}
        </div>
      ))}

      <h2 style={{ fontSize: 14, margin: '20px 0 10px' }}>{t('sub.apps')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {['v2rayNG', 'Nekobox', 'Shadowrocket', 'Hiddify'].map((app) => (
          <div className="card card-pad" key={app} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
            <span className="stat-icon cyan" style={{ width: 34, height: 34 }}><Icon name="download" size={16} /></span>
            <b style={{ fontSize: 12.5 }}>{app}</b>
          </div>
        ))}
      </div>

      <Modal open={!!qr} title={qr?.name ?? ''} onClose={() => setQr(null)}>
        {qr && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}><QRCode value={qr.link} size={200} /></div>
          <CopyBtn text={qr.link} />
        </div>}
      </Modal>
    </div>
  );
}
