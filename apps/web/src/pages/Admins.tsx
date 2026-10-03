import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { ErrorState, Modal, SkelRows, StatusBadge, useToast } from '../components/ui.js';

interface AdminRow { id: string; username: string; displayName: string; role: string; status: string; isSelf: boolean; createdAt: string }

export default function Admins() {
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admins'], queryFn: () => get<AdminRow[]>('/admins') });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admins'] });

  return (
    <>
      <h1 className="page-title">{t('admins.title')}</h1>
      <p className="page-sub"> </p>
      <div className="toolbar"><div className="spacer" /><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={15} />{t('admins.create')}</button></div>
      {q.isLoading && <SkelRows />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="card"><div className="table-wrap">
          <table className="vt">
            <thead><tr><th>{t('common.username')}</th><th>{t('admins.role')}</th><th>Created</th><th>{t('common.status')}</th><th style={{ textAlign: 'end' }}>{t('common.actions')}</th></tr></thead>
            <tbody>
              {q.data.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.username} {a.isSelf && <span className="badge blue">you</span>}</td>
                  <td><span className="badge violet">{a.role}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{date(a.createdAt)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div className="row-actions">
                      {!a.isSelf && (
                        <>
                          <select className="select" style={{ height: 31, width: 110, fontSize: 11 }} value={a.role} aria-label={t('admins.role')}
                            onChange={(e) => patch(`/admins/${a.id}`, { role: e.target.value }).then(() => { invalidate(); toast(t('common.save')); })}>
                            {['OWNER', 'ADMIN', 'SUPPORT', 'VIEWER', 'RESELLER'].map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button className="btn secondary sm" onClick={async () => { const r = await post<{ temporaryPassword: string }>(`/admins/${a.id}/reset-password`); setTempPw(r.temporaryPassword); }}>{t('admins.resetPassword')}</button>
                          <button className="btn secondary sm" onClick={() => post(`/admins/${a.id}/revoke-sessions`).then(() => toast(t('admins.revokeSessions')))}>{t('admins.revokeSessions')}</button>
                          <button className="btn danger sm" onClick={() => patch(`/admins/${a.id}`, { status: a.status === 'active' ? 'disabled' : 'active' }).then(() => { invalidate(); toast(t('common.save')); })}>
                            {a.status === 'active' ? t('common.disabled') : t('common.active')}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      <CreateAdminModal open={open} onClose={() => setOpen(false)} />
      <Modal open={!!tempPw} title={t('admins.resetPassword')} onClose={() => setTempPw(null)}>
        <p style={{ color: 'var(--warning)', fontSize: 12 }}>{t('apikeys.secretHint')}</p>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 13, direction: 'ltr' }}>{tempPw}</pre>
      </Modal>
    </>
  );
}

function CreateAdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ username: '', password: '', displayName: '', role: 'SUPPORT' });
  const m = useMutation({
    mutationFn: () => post('/admins', f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast(t('admins.create')); onClose(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <Modal open={open} title={t('admins.create')} onClose={onClose}>
      <div className="form-grid">
        <div className="field"><label>{t('common.username')}</label><input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
        <div className="field"><label>{t('common.password')}</label><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div className="field"><label>{t('common.name')}</label><input className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
        <div className="field"><label>{t('admins.role')}</label>
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {['ADMIN', 'SUPPORT', 'VIEWER', 'RESELLER'].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!f.username || f.password.length < 8 || m.isPending} onClick={() => m.mutate()}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
