import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EndUserDto, Paginated, PlanDto, SubscriptionDto } from '@vira/shared';
import { get, patch, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Confirm, CopyBtn, Empty, ErrorState, Modal, Pager, SkelRows, StatusBadge, TrafficBar, useToast } from '../components/ui.js';

export default function Subscriptions() {
  const { t, num, date } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [toRevoke, setToRevoke] = useState<SubscriptionDto | null>(null);

  const q = useQuery({ queryKey: ['subs', page], queryFn: () => get<Paginated<SubscriptionDto>>(`/subscriptions?page=${page}`), placeholderData: (p) => p });

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => (body ? patch(path, body) : post(path, body)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subs'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast(t('common.save')); },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <>
      <h1 className="page-title">{t('subs.title')}</h1>
      <p className="page-sub">{num(q.data?.total ?? 0)}</p>
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} />{t('subs.create')}</button>
      </div>

      <div className="card">
        {q.isLoading && <SkelRows />}
        {q.isError && <ErrorState onRetry={() => q.refetch()} />}
        {q.data && q.data.items.length === 0 && <Empty icon="subscription" />}
        {q.data && q.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="vt">
              <thead><tr><th>{t('common.username')}</th><th>{t('users.plan')}</th><th>{t('users.traffic')}</th><th>{t('users.expire')}</th><th>{t('common.status')}</th><th style={{ textAlign: 'end' }}>{t('common.actions')}</th></tr></thead>
              <tbody>
                {q.data.items.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.endUserUsername}</td>
                    <td style={{ color: 'var(--muted)' }}>{s.planName ?? '—'}</td>
                    <td><TrafficBar used={s.trafficUsedBytes} quota={s.trafficQuotaBytes} /></td>
                    <td style={{ color: 'var(--muted)' }}>{date(s.expiresAt)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <div className="row-actions">
                        <CopyBtn text={`${location.origin}/sub/${s.token}`} />
                        <button className="btn secondary sm" onClick={() => act.mutate({ path: `/subscriptions/${s.id}/renew` })}>{t('subs.renew')}</button>
                        <button className="btn secondary sm" onClick={() => act.mutate({ path: `/subscriptions/${s.id}/reset-traffic` })}>{t('subs.resetTraffic')}</button>
                        <button className="btn secondary sm" onClick={() => act.mutate({ path: `/subscriptions/${s.id}/regenerate-token` })}>{t('subs.regenToken')}</button>
                        {s.status === 'active' && <button className="btn danger sm" onClick={() => setToRevoke(s)}>{t('subs.revoke')}</button>}
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

      <CreateSubModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <Confirm open={!!toRevoke} title={t('subs.revoke')} body={t('subs.confirmRevoke')}
        onCancel={() => setToRevoke(null)}
        onConfirm={async () => { if (toRevoke) await post(`/subscriptions/${toRevoke.id}/revoke`); setToRevoke(null); qc.invalidateQueries({ queryKey: ['subs'] }); toast(t('subs.revoke')); }} />
    </>
  );
}

function CreateSubModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [userId, setUserId] = useState('');
  const [planId, setPlanId] = useState('');
  const users = useQuery({ queryKey: ['users-simple'], queryFn: () => get<Paginated<EndUserDto>>('/users?pageSize=100'), enabled: open });
  const plans = useQuery({ queryKey: ['plans-simple'], queryFn: () => get<PlanDto[]>('/plans'), enabled: open });
  const m = useMutation({
    mutationFn: () => post('/subscriptions', { endUserId: userId, planId: planId || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subs'] }); toast(t('subs.create')); onClose(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <Modal open={open} title={t('subs.create')} onClose={onClose}>
      <div className="field"><label>{t('nav.users')}</label>
        <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">—</option>
          {users.data?.items.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
        </select>
      </div>
      <div className="field"><label>{t('users.plan')}</label>
        <select className="select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">—</option>
          {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!userId || m.isPending} onClick={() => m.mutate()}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
