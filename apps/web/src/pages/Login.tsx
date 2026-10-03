import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '../components/icons.js';
import { useI18n } from '../lib/i18n.js';
import { post } from '../lib/api.js';
import { BRAND } from '@vira/shared';

export default function Login() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await post('/auth/login', { username, password });
      qc.invalidateQueries();
      navigate('/');
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-logo"><Logo size={30} /></div>
        <h1 style={{ textAlign: 'center', fontSize: 19, margin: '0 0 4px' }}>{BRAND.name}</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, margin: '0 0 22px' }}>{t('login.title')}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="u">{t('common.username')}</label>
            <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="p">{t('common.password')}</label>
            <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {err && <div className="form-err" style={{ marginBottom: 10 }}>{err}</div>}
          <button className="btn primary" style={{ width: '100%', height: 42 }} disabled={busy}>{busy ? t('common.loading') : t('common.login')}</button>
        </form>
        {import.meta.env.DEV && (
          <div className="dev-hint">
            {t('login.devHint')}: <b>owner / Owner@12345</b>
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn ghost sm" onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}>
            {locale === 'fa' ? 'English' : 'فارسی'}
          </button>
        </div>
      </div>
    </div>
  );
}
