import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanDto } from '@vira/shared';
import { get, patch, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Empty, ErrorState, Modal, SkelRows, StatusBadge, useToast } from '../components/ui.js';

export default function Plans() {
  const { t, num, bytes } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['plans'], queryFn: () => get<PlanDto[]>('/plans') });
  const toggle = useMutation({
    mutationFn: (p: PlanDto) => patch(`/plans/${p.id}`, { active: !p.active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); toast(t('common.save')); },
  });

  return (
    <>
      <h1 className="page-title">{t('plans.title')}</h1>
      <p className="page-sub">{num(q.data?.length ?? 0)}</p>
      <div className="toolbar"><div className="spacer" /><button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={15} />{t('plans.create')}</button></div>
      {q.isLoading && <SkelRows />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <div className="card"><Empty icon="plan" /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {q.data?.map((p) => (
          <div className="card card-pad" key={p.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="stat-icon violet" style={{ width: 42, height: 42 }}><Icon name="plan" size={20} /></span>
              <div><b style={{ fontSize: 14 }}>{p.name}</b><div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{p.description}</div></div>
              <span style={{ marginInlineStart: 'auto' }}><StatusBadge status={p.active ? 'active' : 'disabled'} /></span>
            </div>
            <div className="legend" style={{ marginTop: 14 }}>
              <div className="legend-row">{t('plans.traffic')}<b>{p.trafficBytes > 0 ? bytes(p.trafficBytes) : '∞'}</b></div>
              <div className="legend-row">{t('plans.duration')}<b>{num(p.durationDays)} {t('common.days')}</b></div>
              <div className="legend-row">{t('plans.price')}<b>{num(p.price)}</b></div>
            </div>
            <div style={{ marginTop: 12 }}><button className="btn secondary sm" onClick={() => toggle.mutate(p)}>{p.active ? t('common.disabled') : t('common.active')}</button></div>
          </div>
        ))}
      </div>
      <PlanModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: '', description: '', gb: '100', days: '30', price: '0' });
  const m = useMutation({
    mutationFn: () => post('/plans', { name: f.name, description: f.description, trafficBytes: Number(f.gb) * 1e9, durationDays: Number(f.days), price: Number(f.price) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); toast(t('plans.create')); onClose(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <Modal open={open} title={t('plans.create')} onClose={onClose}>
      <div className="form-grid">
        <div className="field"><label>{t('common.name')}</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>{t('plans.traffic')} (GB)</label><input className="input" type="number" value={f.gb} onChange={(e) => setF({ ...f, gb: e.target.value })} /></div>
        <div className="field"><label>{t('plans.duration')}</label><input className="input" type="number" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></div>
        <div className="field"><label>{t('plans.price')}</label><input className="input" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
      </div>
      <div className="field"><label>Description</label><textarea className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!f.name || m.isPending} onClick={() => m.mutate()}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
