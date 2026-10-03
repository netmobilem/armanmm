import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Empty, ErrorState, Modal, SkelRows, StatusBadge, useToast } from '../components/ui.js';

interface Reseller { id: string; username: string; displayName: string; status: string; userCount: number; subscriptionCount: number; maxUsers: number; createdAt: string }

export default function Resellers() {
  const { t, num, date } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['resellers'], queryFn: () => get<Reseller[]>('/resellers') });
  const disableM = useMutation({
    mutationFn: (id: string) => patch(`/resellers/${id}`, { status: 'disabled' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resellers'] }); toast(t('common.save')); },
  });

  return (
    <>
      <h1 className="page-title">{t('resellers.title')}</h1>
      <p className="page-sub">{num(q.data?.length ?? 0)}</p>
      <div className="toolbar"><div className="spacer" /><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={15} />{t('resellers.create')}</button></div>
      {q.isLoading && <SkelRows />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <div className="card"><Empty icon="reseller" /></div>}
      {q.data && q.data.length > 0 && (
        <div className="card"><div className="table-wrap">
          <table className="vt">
            <thead><tr><th>{t('common.username')}</th><th>{t('resellers.users')}</th><th>{t('nav.subscriptions')}</th><th>{t('resellers.maxUsers')}</th><th>Created</th><th>{t('common.status')}</th><th style={{ textAlign: 'end' }}>{t('common.actions')}</th></tr></thead>
            <tbody>
              {q.data.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.username}</td>
                  <td>{num(r.userCount)}</td>
                  <td>{num(r.subscriptionCount)}</td>
                  <td>{num(r.maxUsers)}</td>
                  <td style={{ color: 'var(--muted)' }}>{date(r.createdAt)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><div className="row-actions">{r.status === 'active' && <button className="btn danger sm" onClick={() => disableM.mutate(r.id)}>{t('common.disabled')}</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
      <ResellerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ResellerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ username: '', password: '', displayName: '', maxUsers: '50' });
  const m = useMutation({
    mutationFn: () => post('/resellers', { username: f.username, password: f.password, displayName: f.displayName, maxUsers: Number(f.maxUsers) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resellers'] }); toast(t('resellers.create')); onClose(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <Modal open={open} title={t('resellers.create')} onClose={onClose}>
      <div className="form-grid">
        <div className="field"><label>{t('common.username')}</label><input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
        <div className="field"><label>{t('common.password')}</label><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div className="field"><label>{t('common.name')}</label><input className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
        <div className="field"><label>{t('resellers.maxUsers')}</label><input className="input" type="number" value={f.maxUsers} onChange={(e) => setF({ ...f, maxUsers: e.target.value })} /></div>
      </div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!f.username || f.password.length < 8 || m.isPending} onClick={() => m.mutate()}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
