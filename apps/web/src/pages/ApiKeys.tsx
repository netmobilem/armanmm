import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Confirm, CopyBtn, Empty, ErrorState, Modal, SkelRows, useToast } from '../components/ui.js';
import { PERMISSIONS } from '@vira/shared';

interface KeyRow { id: string; name: string; prefix: string; scopes: string[]; rateLimit: number; lastUsedAt: string | null; expiresAt: string | null; createdAt: string }

export default function ApiKeys() {
  const { t, num, date, rel } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<KeyRow | null>(null);
  const q = useQuery({ queryKey: ['apikeys'], queryFn: () => get<KeyRow[]>('/api-keys') });

  return (
    <>
      <h1 className="page-title">{t('apikeys.title')}</h1>
      <p className="page-sub">{num(q.data?.length ?? 0)}</p>
      <div className="toolbar"><div className="spacer" /><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={15} />{t('apikeys.create')}</button></div>
      {q.isLoading && <SkelRows />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <div className="card"><Empty icon="key" /></div>}
      {q.data && q.data.length > 0 && (
        <div className="card"><div className="table-wrap">
          <table className="vt">
            <thead><tr><th>{t('common.name')}</th><th>Prefix</th><th>{t('apikeys.scopes')}</th><th>Last used</th><th>{t('users.expire')}</th><th style={{ textAlign: 'end' }}>{t('common.actions')}</th></tr></thead>
            <tbody>
              {q.data.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{k.prefix}…</td>
                  <td><span className="badge blue">{k.scopes.includes('*') ? 'full' : `${k.scopes.length} scopes`}</span></td>
                  <td style={{ color: 'var(--muted-2)', fontSize: 11.5 }}>{rel(k.lastUsedAt)}</td>
                  <td style={{ color: 'var(--muted)' }}>{date(k.expiresAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn secondary sm" onClick={async () => { const r = await post<{ secret: string }>(`/api-keys/${k.id}/rotate`); setSecret(r.secret); qc.invalidateQueries({ queryKey: ['apikeys'] }); }}>{t('configs.rotate')}</button>
                      <button className="btn danger sm" onClick={() => setToRevoke(k)}>{t('subs.revoke')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      <CreateKeyModal open={open} onClose={() => setOpen(false)} onSecret={setSecret} />

      <Modal open={!!secret} title={t('apikeys.title')} onClose={() => setSecret(null)}>
        <p style={{ color: 'var(--warning)', fontSize: 12 }}>{t('apikeys.secretHint')}</p>
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 11.5, direction: 'ltr', textAlign: 'left', wordBreak: 'break-all' }}>{secret}</pre>
        <div className="modal-foot"><CopyBtn text={secret ?? ''} label={t('common.copy')} /></div>
      </Modal>

      <Confirm open={!!toRevoke} title={t('subs.revoke')} body={t('apikeys.confirmRevoke')}
        onCancel={() => setToRevoke(null)}
        onConfirm={async () => { if (toRevoke) import('../lib/api.js').then((m) => m.del(`/api-keys/${toRevoke.id}`)); setToRevoke(null); qc.invalidateQueries({ queryKey: ['apikeys'] }); toast(t('subs.revoke')); }} />
    </>
  );
}

function CreateKeyModal({ open, onClose, onSecret }: { open: boolean; onClose: () => void; onSecret: (s: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ name: '', scope: '*', days: '' });
  const m = useMutation({
    mutationFn: () => post<{ id: string; secret: string }>('/api-keys', {
      name: f.name,
      scopes: f.scope === '*' ? ['*'] : [f.scope],
      expiresDays: f.days ? Number(f.days) : null,
    }),
    onSuccess: (r) => { onSecret(r.secret); toast(t('apikeys.create')); onClose(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <Modal open={open} title={t('apikeys.create')} onClose={onClose}>
      <div className="field"><label>{t('common.name')}</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label>{t('apikeys.scopes')}</label>
        <select className="select" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
          <option value="*">* (all permissions of your role)</option>
          {PERMISSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="field"><label>Expires in (days, empty = never)</label><input className="input" type="number" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!f.name || m.isPending} onClick={() => m.mutate()}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
