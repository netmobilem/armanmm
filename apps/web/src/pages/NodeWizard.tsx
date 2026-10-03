import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { useToast } from '../components/ui.js';

export default function NodeWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', location: '', address: '', port: '443', core: 'xray' });
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const steps = [t('wizard.basic'), t('nodes.address'), t('nodes.test'), t('wizard.review')];

  const create = useMutation({
    // if the connection-test step already persisted the node, just finish the wizard
    mutationFn: () => createdId
      ? Promise.resolve(null)
      : post('/nodes', { name: form.name, location: form.location, address: form.address, port: Number(form.port), core: form.core }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); toast(t('nodes.create')); navigate('/nodes'); },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link to="/nodes" className="btn ghost sm">←</Link>
        <h1 className="page-title" style={{ margin: 0 }}>{t('nodes.create')}</h1>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {steps.map((s, i) => (
          <button key={s} className="btn sm" onClick={() => i < step && setStep(i)}
            style={i === step ? { background: 'var(--primary)', color: '#fff' } : i < step ? { background: 'var(--primary-soft)', color: 'var(--text)' } : { color: 'var(--muted-2)' }}>
            {i + 1}. {s}
          </button>
        ))}
      </div>
      <div className="card card-pad" style={{ maxWidth: 640 }}>
        {step === 0 && (
          <div className="form-grid">
            <div className="field"><label>{t('common.name')}</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IR - Tehran" /></div>
            <div className="field"><label>{t('nodes.location')}</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          </div>
        )}
        {step === 1 && (
          <div className="form-grid">
            <div className="field"><label>{t('nodes.address')}</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="node1.example.com" /></div>
            <div className="field"><label>{t('configs.port')}</label><input className="input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></div>
            <div className="field"><label>Core</label>
              <select className="select" value={form.core} onChange={(e) => setForm({ ...form, core: e.target.value })}>
                <option value="xray">Xray</option><option value="sing-box">Sing-box</option><option value="hysteria">Hysteria</option>
              </select>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>{t('nodes.test')} — TCP {form.address}:{form.port}</p>
            <button className="btn secondary" onClick={async () => {
              try {
                let id = createdId;
                if (!id) {
                  const created = await post<{ id: string }>('/nodes', { ...form, port: Number(form.port) });
                  id = created.id;
                  setCreatedId(id);
                }
                const r = await post<{ ok: boolean; latencyMs: number }>(`/nodes/${id}/test`);
                setTestResult(r);
              } catch (e) { setTestResult({ ok: false, latencyMs: -1 }); toast((e as Error).message, 'error'); }
            }}>{t('nodes.test')}</button>
            {testResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`node-dot ${testResult.ok ? 'online' : 'offline'}`} />
                {testResult.ok ? `OK · ${testResult.latencyMs}ms` : 'Unreachable — you can still save the node'}
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="legend">
            <div className="legend-row">{t('common.name')}<b>{form.name}</b></div>
            <div className="legend-row">{t('nodes.location')}<b>{form.location || '—'}</b></div>
            <div className="legend-row">{t('nodes.address')}<b>{form.address}:{form.port}</b></div>
            <div className="legend-row">Core<b>{form.core}</b></div>
          </div>
        )}
        <div className="modal-foot">
          {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>←</button>}
          {step < steps.length - 1 && <button className="btn primary" disabled={step === 0 ? !form.name : step === 1 ? !form.address : false} onClick={() => setStep(step + 1)}>→</button>}
          {step === steps.length - 1 && <button className="btn primary" disabled={create.isPending} onClick={() => create.mutate()}>{t('common.save')}</button>}
        </div>
      </div>
    </>
  );
}
