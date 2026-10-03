import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EndUserDto, GroupDto, Paginated, PlanDto } from '@vira/shared';
import { del, get, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { Confirm, Empty, ErrorState, Modal, Pager, SkelRows, StatusBadge, TrafficBar, useToast } from '../components/ui.js';

export default function Users() {
  const { t, num, date, rel } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<EndUserDto | null>(null);

  const q = useQuery({
    queryKey: ['users', page, search, status],
    queryFn: () => get<Paginated<EndUserDto>>(`/users?page=${page}&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ''}`),
    placeholderData: (prev) => prev,
  });
  const options = useQuery({ queryKey: ['meta-options'], queryFn: () => get<{ groups: GroupDto[]; plans: PlanDto[] }>('/meta/options') });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const action = useMutation({
    mutationFn: ({ fn, id }: { fn: (id: string) => Promise<unknown>; id: string }) => fn(id),
    onSuccess: () => { invalidate(); toast(t('common.save')); },
  });
  const bulk = useMutation({
    mutationFn: (body: unknown) => post('/users/bulk', body),
    onSuccess: () => { invalidate(); setSelected(new Set()); toast(t('common.save')); },
  });

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <h1 className="page-title">{t('users.title')}</h1>
      <p className="page-sub">{num(q.data?.total ?? 0)} · {t('dash.subtitle')}</p>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 240 }} placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="select" style={{ maxWidth: 150 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={t('common.status')}>
          <option value="">{t('common.status')}</option>
          <option value="active">{t('common.active')}</option>
          <option value="suspended">{t('common.suspended')}</option>
          <option value="expired">{t('common.expired')}</option>
        </select>
        <div className="spacer" />
        {selected.size > 0 && (
          <>
            <button className="btn secondary sm" onClick={() => bulk.mutate({ ids: [...selected], action: 'suspend' })}>{t('users.suspend')}</button>
            <button className="btn secondary sm" onClick={() => bulk.mutate({ ids: [...selected], action: 'activate' })}>{t('users.activate')}</button>
            <button className="btn danger sm" onClick={() => bulk.mutate({ ids: [...selected], action: 'delete' })}>{t('common.delete')}</button>
          </>
        )}
        <button className="btn primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} />{t('users.create')}</button>
      </div>

      <div className="card">
        {q.isLoading && <SkelRows />}
        {q.isError && <ErrorState onRetry={() => q.refetch()} />}
        {q.data && q.data.items.length === 0 && <Empty icon="users" />}
        {q.data && q.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="vt">
              <thead>
                <tr>
                  <th style={{ width: 34 }}><input type="checkbox" aria-label="select all" checked={selected.size === q.data.items.length && selected.size > 0} onChange={(e) => setSelected(e.target.checked ? new Set(q.data?.items.map((i) => i.id)) : new Set())} /></th>
                  <th>{t('common.username')}</th>
                  <th>{t('users.traffic')}</th>
                  <th>{t('users.expire')}</th>
                  <th>{t('users.lastActive')}</th>
                  <th>{t('common.status')}</th>
                  <th style={{ textAlign: 'end' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((u) => (
                  <tr key={u.id}>
                    <td><input type="checkbox" aria-label={u.username} checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
                    <td>
                      <Link to={`/users/${u.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontWeight: 600 }}>
                        {u.online && <span className="node-dot online" style={{ width: 7, height: 7 }} />}
                        {u.username}
                      </Link>
                    </td>
                    <td><TrafficBar used={u.trafficUsedBytes} quota={u.trafficQuotaBytes} /></td>
                    <td style={{ color: 'var(--muted)' }}>{date(u.expireAt)}</td>
                    <td style={{ color: 'var(--muted-2)', fontSize: 11.5 }}>{rel(u.lastActiveAt)}</td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title={u.status === 'active' ? t('users.suspend') : t('users.activate')}
                          onClick={() => action.mutate({ fn: (id) => post(`/users/${id}/${u.status === 'active' ? 'suspend' : 'activate'}`), id: u.id })}>
                          <Icon name={u.status === 'active' ? 'warn' : 'check'} size={15} />
                        </button>
                        <button className="icon-btn" title={t('common.delete')} onClick={() => setToDelete(u)}><Icon name="trash" size={15} /></button>
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

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} groups={options.data?.groups ?? []} plans={options.data?.plans ?? []} />
      <Confirm open={!!toDelete} title={t('common.delete')} body={t('users.confirmDelete')}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await del(`/users/${toDelete.id}`); setToDelete(null); invalidate(); toast(t('common.delete')); }} />
    </>
  );
}

function CreateUserModal({ open, onClose, groups, plans }: { open: boolean; onClose: () => void; groups: GroupDto[]; plans: PlanDto[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ username: '', displayName: '', groupId: '', planId: '', quotaGb: '100', days: '30', tags: '' });
  const m = useMutation({
    mutationFn: () => post('/users', {
      username: form.username,
      displayName: form.displayName || form.username,
      groupId: form.groupId || null,
      planId: form.planId || null,
      trafficQuotaBytes: Number(form.quotaGb) * 1e9,
      expireAt: new Date(Date.now() + Number(form.days) * 86_400_000).toISOString(),
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast(t('users.create')); onClose(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <Modal open={open} title={t('users.create')} onClose={onClose}>
      <div className="form-grid">
        <div className="field"><label>{t('common.username')}</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
        <div className="field"><label>{t('common.name')}</label><input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
        <div className="field"><label>{t('users.group')}</label>
          <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
            <option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="field"><label>{t('users.plan')}</label>
          <select className="select" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
            <option value="">—</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field"><label>{t('users.quota')} (GB)</label><input className="input" type="number" min={0} value={form.quotaGb} onChange={(e) => setForm({ ...form, quotaGb: e.target.value })} /></div>
        <div className="field"><label>{t('users.expire')} ({t('common.days')})</label><input className="input" type="number" min={1} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></div>
      </div>
      <div className="field"><label>{t('users.tags')}</label><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, test" /></div>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={m.isPending || !form.username} onClick={() => m.mutate()}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
