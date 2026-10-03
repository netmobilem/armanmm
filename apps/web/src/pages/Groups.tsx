import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GroupDto } from '@vira/shared';
import { get, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Empty, ErrorState, Modal, SkelRows, useToast } from '../components/ui.js';

export default function Groups() {
  const { t, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['groups'], queryFn: () => get<GroupDto[]>('/groups') });
  const delM = useMutation({
    mutationFn: (id: string) => import('../lib/api.js').then((m) => m.del(`/groups/${id}`)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); toast(t('common.delete')); },
  });

  return (
    <>
      <h1 className="page-title">{t('groups.title')}</h1>
      <p className="page-sub">{num(q.data?.length ?? 0)}</p>
      <div className="toolbar"><div className="spacer" /><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={15} />{t('groups.create')}</button></div>
      {q.isLoading && <SkelRows />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <div className="card"><Empty icon="group" /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {q.data?.map((g) => (
          <div className="card card-pad" key={g.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="stat-icon cyan" style={{ width: 42, height: 42 }}><Icon name="group" size={20} /></span>
              <div><b>{g.name}</b><div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{g.description}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {(g.allowedProtocols.length ? g.allowedProtocols : ['vless', 'vmess', 'trojan']).map((p) => <span key={p} className="badge violet">{String(p).toUpperCase()}</span>)}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn danger sm" onClick={() => delM.mutate(g.id)}><Icon name="trash" size={13} />{t('common.delete')}</button>
            </div>
          </div>
        ))}
      </div>
      <GroupModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function GroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: '', description: '', protocols: ['vless'] as string[] });
  const m = useMutation({
    mutationFn: () => post('/groups', { name: f.name, description: f.description, allowedProtocols: f.protocols }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); toast(t('groups.create')); onClose(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <Modal open={open} title={t('groups.create')} onClose={onClose}>
      <div className="field"><label>{t('common.name')}</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label>Description</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="field"><label>{t('groups.protocols')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['vless', 'vmess', 'trojan'].map((p) => (
            <button key={p} type="button" className="btn sm" style={f.protocols.includes(p) ? { background: 'var(--primary)', color: '#fff' } : { background: 'var(--surface-2)' }}
              onClick={() => setF({ ...f, protocols: f.protocols.includes(p) ? f.protocols.filter((x) => x !== p) : [...f.protocols, p] })}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!f.name || m.isPending} onClick={() => m.mutate()}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
