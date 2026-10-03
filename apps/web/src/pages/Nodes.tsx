import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NodeDto, Paginated } from '@vira/shared';
import { del, get, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Confirm, Empty, ErrorState, Modal, SkelRows, StatusBadge, useToast } from '../components/ui.js';

export default function Nodes() {
  const { t, num, bytes, rel } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [token, setToken] = useState<{ node: string; token: string } | null>(null);
  const [test, setTest] = useState<{ node: string; ok: boolean; latencyMs: number } | null>(null);
  const [toDelete, setToDelete] = useState<NodeDto | null>(null);

  const q = useQuery({ queryKey: ['nodes'], queryFn: () => get<Paginated<NodeDto>>('/nodes?pageSize=100'), refetchInterval: 20_000 });

  const act = useMutation({
    mutationFn: ({ path }: { path: string }) => post(path),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); toast(t('common.save')); },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <>
      <h1 className="page-title">{t('nodes.title')}</h1>
      <p className="page-sub">{num(q.data?.total ?? 0)}</p>
      <div className="toolbar">
        <div className="spacer" />
        <Link className="btn primary" to="/nodes/new"><Icon name="plus" size={15} />{t('nodes.create')}</Link>
      </div>

      {q.isLoading && <SkelRows />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && <div className="card"><Empty icon="server" /></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {q.data?.items.map((n) => (
          <div className="card card-pad" key={n.id}>
            <div className="node-head">
              <span className={`node-dot ${n.status}`} />
              <div>
                <b style={{ fontSize: 14 }}>{n.name}</b>
                <div style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{n.location} · {n.address}:{num(n.port)} · {n.core}</div>
              </div>
              <span style={{ marginInlineStart: 'auto' }}><StatusBadge status={n.status} /></span>
            </div>
            <div className="node-metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div><div className="meter-label"><span>{t('dash.cpu')}</span><span>{num(n.metrics?.cpu ?? 0)}%</span></div><div className="progress"><span style={{ width: `${n.metrics?.cpu ?? 0}%` }} /></div></div>
              <div><div className="meter-label"><span>{t('dash.mem')}</span><span>{num(n.metrics?.memory ?? 0)}%</span></div><div className="progress"><span style={{ width: `${n.metrics?.memory ?? 0}%` }} /></div></div>
              <div><div className="meter-label"><span>{t('dash.connections')}</span><span>{num(n.metrics?.connections ?? 0)}</span></div><div className="progress"><span style={{ width: `${Math.min(100, ((n.metrics?.connections ?? 0) / 400) * 100)}%` }} /></div></div>
              <div><div className="meter-label"><span>{t('dash.traffic')}</span><span>{bytes((n.metrics?.trafficIn ?? 0) + (n.metrics?.trafficOut ?? 0))}</span></div><div className="progress"><span style={{ width: '40%' }} /></div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: 'var(--muted-2)', fontSize: 10.5 }}>
              <Icon name="clock" size={13} /> {t('nodes.heartbeat')}: {rel(n.lastHeartbeatAt)}
              {n.latencyMs !== null && <span style={{ marginInlineStart: 'auto' }}>{t('nodes.latency')}: {num(n.latencyMs)}ms</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn secondary sm" onClick={() => act.mutate({ path: `/nodes/${n.id}/${n.enabled ? 'disable' : 'enable'}` })}>
                {n.enabled ? t('common.disabled') : t('common.active')}
              </button>
              <button className="btn secondary sm" onClick={async () => {
                const r = await post<{ ok: boolean; latencyMs: number }>(`/nodes/${n.id}/test`);
                setTest({ node: n.name, ...r });
              }}>{t('nodes.test')}</button>
              <button className="btn secondary sm" onClick={async () => {
                const r = await post<{ token: string }>(`/nodes/${n.id}/agent-token`);
                setToken({ node: n.name, token: r.token });
              }}>{t('nodes.agentToken')}</button>
              <button className="btn danger sm" style={{ marginInlineStart: 'auto' }} onClick={() => setToDelete(n)}><Icon name="trash" size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!token} title={`${t('nodes.agentToken')} — ${token?.node}`} onClose={() => setToken(null)}>
        <p style={{ color: 'var(--warning)', fontSize: 12 }}>{t('nodes.agentTokenHint')}</p>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 11, direction: 'ltr', textAlign: 'left', wordBreak: 'break-all' }}>{token?.token}</pre>
        <div className="modal-foot"><CopyToken text={token?.token ?? ''} /></div>
      </Modal>

      <Modal open={!!test} title={t('nodes.test')} onClose={() => setTest(null)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
          <span className={`node-dot ${test?.ok ? 'online' : 'offline'}`} />
          {test?.node}: {test?.ok ? `OK · ${test.latencyMs}ms` : 'FAILED'}
        </div>
      </Modal>

      <Confirm open={!!toDelete} title={t('common.delete')} body={t('nodes.confirmDelete')}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await del(`/nodes/${toDelete.id}`); setToDelete(null); qc.invalidateQueries({ queryKey: ['nodes'] }); toast(t('common.delete')); }} />
    </>
  );
}

function CopyToken({ text }: { text: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return <button className="btn primary" onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { /* noop */ } toast(t('common.copied')); }}>
    <Icon name="copy" size={14} />{t('common.copy')}
  </button>;
}
