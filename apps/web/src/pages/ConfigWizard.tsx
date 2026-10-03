import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfigDto, GroupDto, NodeDto } from '@vira/shared';
import { get, post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { Icon } from '../components/icons.js';
import { CopyBtn, useToast } from '../components/ui.js';

const PROTOCOLS = [
  { id: 'vless', desc: 'Modern, lightweight, UUID-based' },
  { id: 'vmess', desc: 'Classic protocol with AES-GCM' },
  { id: 'trojan', desc: 'HTTPS-looking traffic, password-based' },
] as const;
const TRANSPORTS = [
  { id: 'ws', desc: 'WebSocket' }, { id: 'httpupgrade', desc: 'HTTP Upgrade' }, { id: 'tcp', desc: 'Raw TCP' }, { id: 'grpc', desc: 'gRPC' },
] as const;
const SECURITIES = [
  { id: 'none', desc: 'Plain' }, { id: 'tls', desc: 'TLS' }, { id: 'reality', desc: 'Reality (anti-detection)' },
] as const;

export default function ConfigWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', description: '', protocol: 'vless', transport: 'ws', security: 'tls',
    nodeId: '', port: '443', sni: '', host: '', path: '/', fingerprint: 'chrome',
    realityPublicKey: '', realityShortId: '', serviceName: '', groupId: '',
  });
  const nodes = useQuery({ queryKey: ['nodes-all'], queryFn: () => get<{ items: NodeDto[] }>('/nodes?pageSize=100') });
  const groups = useQuery({ queryKey: ['groups-all'], queryFn: () => get<GroupDto[]>('/groups') });

  const steps = [t('wizard.basic'), t('configs.protocol'), t('configs.transport'), t('configs.security'), t('configs.node'), t('wizard.advanced'), t('wizard.review')];

  const save = useMutation({
    mutationFn: () => post<ConfigDto>('/configs', {
      name: form.name, description: form.description, protocol: form.protocol, transport: form.transport,
      security: form.security, nodeId: form.nodeId, port: Number(form.port),
      sni: form.sni || null, host: form.host || null, path: form.path || null,
      fingerprint: form.security !== 'none' ? form.fingerprint || null : null,
      realityPublicKey: form.realityPublicKey || null, realityShortId: form.realityShortId || null,
      serviceName: form.transport === 'grpc' ? form.serviceName || null : null,
      groupId: form.groupId || null,
    }),
    onSuccess: (cfg) => { qc.invalidateQueries({ queryKey: ['configs'] }); toast(t('configs.create')); navigate('/configs', { state: { created: cfg.id } }); },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const previewSpec = useMemo(() => ({
    remark: form.name || 'preview', protocol: form.protocol, transport: form.transport, security: form.security,
    address: nodes.data?.items.find((n) => n.id === form.nodeId)?.address ?? '203.0.113.10',
    port: Number(form.port) || 443,
    credential: '00000000-0000-4000-8000-000000000000',
    sni: form.sni || null, host: form.host || null, path: form.path || null, fingerprint: form.fingerprint || null,
  }), [form, nodes.data]);

  const previewLink = useMemo(() => {
    const p = new URLSearchParams();
    if (previewSpec.protocol !== 'vmess') p.set('encryption', 'none');
    p.set('type', previewSpec.transport);
    if (previewSpec.path) p.set('path', previewSpec.path);
    if (previewSpec.host) p.set('host', previewSpec.host);
    if (previewSpec.security !== 'none') { p.set('security', previewSpec.security); if (previewSpec.sni) p.set('sni', previewSpec.sni); if (previewSpec.fingerprint) p.set('fp', previewSpec.fingerprint); }
    const cred = previewSpec.protocol === 'trojan' ? 'password' : previewSpec.credential;
    return `${previewSpec.protocol}://${cred}@${previewSpec.address}:${previewSpec.port}?${p.toString()}#${encodeURIComponent(previewSpec.remark)}`;
  }, [previewSpec]);

  const canNext = [
    form.name.trim().length > 0,
    true, true, true,
    form.nodeId !== '' && Number(form.port) > 0,
    form.security !== 'reality' || form.realityPublicKey.length > 0,
    true,
  ][step];

  const OptionCard = ({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) => (
    <button onClick={onClick} className="card card-pad" style={{ textAlign: 'start', flex: '1 1 160px', borderColor: active ? 'var(--primary)' : undefined, boxShadow: active ? 'var(--ring)' : undefined }}>
      <b style={{ fontSize: 13.5, textTransform: 'uppercase' }}>{title}</b>
      <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 4 }}>{desc}</div>
    </button>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link to="/configs" className="btn ghost sm">←</Link>
        <h1 className="page-title" style={{ margin: 0 }}>{t('configs.create')}</h1>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {steps.map((s, i) => (
          <button key={s} className="btn sm" onClick={() => i < step && setStep(i)}
            style={i === step ? { background: 'var(--primary)', color: '#fff' } : i < step ? { background: 'var(--primary-soft)', color: 'var(--text)' } : { color: 'var(--muted-2)' }}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          {step === 0 && (
            <>
              <div className="field"><label>{t('common.name')}</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="tehran-ws-01" /></div>
              <div className="field"><label>Description</label><textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="field"><label>{t('users.group')}</label>
                <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                  <option value="">—</option>
                  {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </>
          )}
          {step === 1 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{PROTOCOLS.map((p) => <OptionCard key={p.id} active={form.protocol === p.id} onClick={() => setForm({ ...form, protocol: p.id })} title={p.id} desc={p.desc} />)}</div>}
          {step === 2 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{TRANSPORTS.map((p) => <OptionCard key={p.id} active={form.transport === p.id} onClick={() => setForm({ ...form, transport: p.id })} title={p.id} desc={p.desc} />)}</div>}
          {step === 3 && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{SECURITIES.filter((s) => !(s.id === 'reality' && form.protocol === 'vmess')).map((p) => <OptionCard key={p.id} active={form.security === p.id} onClick={() => setForm({ ...form, security: p.id })} title={p.id} desc={p.desc} />)}</div>}
          {step === 4 && (
            <>
              <div className="field"><label>{t('configs.node')}</label>
                <select className="select" value={form.nodeId} onChange={(e) => setForm({ ...form, nodeId: e.target.value })}>
                  <option value="">—</option>
                  {nodes.data?.items.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.address})</option>)}
                </select>
              </div>
              <div className="field"><label>{t('configs.port')}</label><input className="input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></div>
            </>
          )}
          {step === 5 && (
            <div className="form-grid">
              <div className="field"><label>SNI</label><input className="input" value={form.sni} onChange={(e) => setForm({ ...form, sni: e.target.value })} /></div>
              <div className="field"><label>Host</label><input className="input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} /></div>
              <div className="field"><label>Path</label><input className="input" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} /></div>
              <div className="field"><label>Fingerprint</label><input className="input" value={form.fingerprint} onChange={(e) => setForm({ ...form, fingerprint: e.target.value })} /></div>
              {form.security === 'reality' && (
                <>
                  <div className="field"><label>Reality Public Key</label><input className="input" value={form.realityPublicKey} onChange={(e) => setForm({ ...form, realityPublicKey: e.target.value })} /></div>
                  <div className="field"><label>Short ID</label><input className="input" value={form.realityShortId} onChange={(e) => setForm({ ...form, realityShortId: e.target.value })} /></div>
                </>
              )}
              {form.transport === 'grpc' && <div className="field"><label>Service Name</label><input className="input" value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} /></div>}
            </div>
          )}
          {step === 6 && (
            <div>
              <div className="card-title" style={{ marginBottom: 10 }}><Icon name="eye" size={16} />{t('configs.preview')}</div>
              <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 10.5, overflowX: 'auto', direction: 'ltr', textAlign: 'left' }}>{previewLink}</pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><CopyBtn text={previewLink} /></div>
            </div>
          )}

          <div className="modal-foot">
            {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>←</button>}
            {step < steps.length - 1 && <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>→</button>}
            {step === steps.length - 1 && <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</button>}
          </div>
        </div>

        <div className="card card-pad" style={{ alignSelf: 'start' }}>
          <div className="card-title" style={{ marginBottom: 10 }}><Icon name="eye" size={16} />{t('configs.preview')}</div>
          <div className="legend">
            <div className="legend-row">{t('configs.protocol')}<b>{form.protocol}</b></div>
            <div className="legend-row">{t('configs.transport')}<b>{form.transport}</b></div>
            <div className="legend-row">{t('configs.security')}<b>{form.security}</b></div>
            <div className="legend-row">{t('configs.node')}<b>{nodes.data?.items.find((n) => n.id === form.nodeId)?.name ?? '—'}</b></div>
            <div className="legend-row">{t('configs.port')}<b>{form.port}</b></div>
          </div>
          <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 9.5, overflowX: 'auto', direction: 'ltr', textAlign: 'left', marginTop: 12 }}>{previewLink}</pre>
        </div>
      </div>
    </>
  );
}
