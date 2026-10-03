import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { ErrorState, SkelRows, useToast } from '../components/ui.js';

type SettingsMap = Record<string, Record<string, unknown>>;

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => get<SettingsMap>('/settings') });
  const [form, setForm] = useState<SettingsMap>({});

  useEffect(() => { if (q.data) setForm(JSON.parse(JSON.stringify(q.data))); }, [q.data]);

  const save = useMutation({
    mutationFn: () => patch('/settings', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast(t('common.save')); },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  if (q.isLoading) return <SkelRows />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const set = (section: string, key: string, value: unknown) =>
    setForm((f) => ({ ...f, [section]: { ...(f[section] ?? {}), [key]: value } }));

  const sections: { id: string; label: string }[] = [
    { id: 'general', label: t('settings.general') },
    { id: 'branding', label: t('settings.branding') },
    { id: 'security', label: t('settings.security') },
    { id: 'subscriptions', label: t('settings.subscriptions') },
    { id: 'nodes', label: t('settings.nodes') },
    { id: 'localization', label: t('settings.localization') },
  ];

  return (
    <>
      <h1 className="page-title">{t('settings.title')}</h1>
      <p className="page-sub"> </p>
      <div className="grid-2">
        {sections.map((s) => (
          <section className="card card-pad" key={s.id}>
            <div className="card-title" style={{ marginBottom: 14 }}>{s.label}</div>
            {Object.entries(form[s.id] ?? {}).map(([k, v]) => (
              <div className="field" key={k}>
                <label>{k}</label>
                {typeof v === 'number'
                  ? <input className="input" type="number" value={Number(v)} onChange={(e) => set(s.id, k, Number(e.target.value))} />
                  : <input className="input" value={String(v ?? '')} onChange={(e) => set(s.id, k, e.target.value)} />}
              </div>
            ))}
            {s.id === 'localization' && (
              <div className="field">
                <label>UI language</label>
                <select className="select" value={locale} onChange={(e) => setLocale(e.target.value as 'fa' | 'en')}>
                  <option value="fa">فارسی (RTL)</option>
                  <option value="en">English (LTR)</option>
                </select>
              </div>
            )}
          </section>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</button>
      </div>
    </>
  );
}
