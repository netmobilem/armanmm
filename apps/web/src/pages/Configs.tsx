import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfigDto, Paginated } from '@vira/shared';
import { get, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Confirm, CopyBtn, Empty, ErrorState, Modal, Pager, SkelRows, StatusBadge, useToast } from '../components/ui.js';
import QRCode from 'react-qr-code';

export default function Configs() {
  const { t, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [qr, setQr] = useState<ConfigDto | null>(null);
  const [toRevoke, setToRevoke] = useState<ConfigDto | null>(null);

  const q = useQuery({
    queryKey: ['configs', page, search],
    queryFn: () => get<Paginated<ConfigDto>>(`/configs?page=${page}&search=${encodeURIComponent(search)}`),
    placeholderData: (p) => p,
  });

  const act = useMutation({
    mutationFn: ({ path }: { path: string }) => post(path),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['configs'] }); toast(t('common.save')); },
  });

  return (
    <>
      <h1 className="page-title">{t('configs.title')}</h1>
      <p className="page-sub">{num(q.data?.total ?? 0)}</p>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 240 }} placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <div className="spacer" />
        <Link className="btn primary" to="/configs/new"><Icon name="plus" size={15} />{t('configs.create')}</Link>
      </div>

      <div className="card">
        {q.isLoading && <SkelRows />}
        {q.isError && <ErrorState onRetry={() => q.refetch()} />}
        {q.data && q.data.items.length === 0 && <Empty icon="config" />}
        {q.data && q.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="vt">
              <thead><tr><th>{t('common.name')}</th><th>{t('configs.protocol')}</th><th>{t('configs.node')}</th><th>{t('configs.port')}</th><th>{t('common.status')}</th><th style={{ textAlign: 'end' }}>{t('common.actions')}</th></tr></thead>
              <tbody>
                {q.data.items.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><span className="badge violet">{c.protocol.toUpperCase()}</span> <span className="badge gray">{c.transport}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{c.nodeName}</td>
                    <td>{num(c.port)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div className="row-actions">
                        {c.link && <CopyBtn text={c.link} />}
                        {c.link && <button className="icon-btn" title={t('sub.qr')} onClick={() => setQr(c)}><Icon name="qr" size={15} /></button>}
                        <button className="icon-btn" title={t('configs.rotate')} onClick={() => act.mutate({ path: `/configs/${c.id}/rotate` })}><Icon name="refresh" size={15} /></button>
                        {c.status !== 'revoked' && <button className="icon-btn" title={t('configs.revoke')} onClick={() => setToRevoke(c)}><Icon name="warn" size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={q.data.page} totalPages={q.data.totalPages} onPage={setPage} />
          </div>
        )}
      </div>

      <Modal open={!!qr} title={qr?.name ?? ''} onClose={() => setQr(null)}>
        {qr?.link && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}><QRCode value={qr.link} size={190} /></div>
            <CopyBtn text={qr.link} label={t('configs.link')} />
          </div>
        )}
      </Modal>

      <Confirm open={!!toRevoke} title={t('configs.revoke')} body={`${toRevoke?.name}?`}
        onCancel={() => setToRevoke(null)}
        onConfirm={async () => { if (toRevoke) await post(`/configs/${toRevoke.id}/revoke`); setToRevoke(null); qc.invalidateQueries({ queryKey: ['configs'] }); toast(t('configs.revoke')); }} />
    </>
  );
}
