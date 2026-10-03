import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon, Logo } from './icons.js';
import { useI18n, type TKey } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import type { NotificationDto, SessionUser } from '@vira/shared';
import { BRAND } from '@vira/shared';
import { useToast } from './ui.js';

const NAV: { to: string; icon: string; key: TKey; perm?: string }[] = [
  { to: '/', icon: 'dashboard', key: 'nav.dashboard' },
  { to: '/users', icon: 'users', key: 'nav.users', perm: 'users.read' },
  { to: '/configs', icon: 'config', key: 'nav.configs', perm: 'configs.read' },
  { to: '/nodes', icon: 'server', key: 'nav.nodes', perm: 'nodes.read' },
  { to: '/subscriptions', icon: 'subscription', key: 'nav.subscriptions', perm: 'subscriptions.read' },
  { to: '/plans', icon: 'plan', key: 'nav.plans', perm: 'plans.read' },
  { to: '/groups', icon: 'group', key: 'nav.groups', perm: 'groups.read' },
  { to: '/resellers', icon: 'reseller', key: 'nav.resellers', perm: 'resellers.read' },
  { to: '/reports', icon: 'report', key: 'nav.reports', perm: 'audit.read' },
  { to: '/activity', icon: 'activity', key: 'nav.activity', perm: 'audit.read' },
  { to: '/api-keys', icon: 'key', key: 'nav.apikeys' },
  { to: '/audit', icon: 'audit', key: 'nav.audit', perm: 'audit.read' },
  { to: '/admins', icon: 'shield', key: 'nav.admins', perm: 'admins.manage' },
  { to: '/settings', icon: 'settings', key: 'nav.settings', perm: 'settings.read' },
  { to: '/health', icon: 'health', key: 'nav.health' },
];

export default function Layout() {
  const { t, locale, setLocale, rel } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const me = useQuery({ queryKey: ['me'], queryFn: () => get<SessionUser>('/auth/me') });
  const notifs = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get<{ unread: number; items: NotificationDto[] }>('/notifications'),
    refetchInterval: 45_000,
  });

  // realtime invalidation over SSE
  useEffect(() => {
    const src = new EventSource('/api/v1/events', { withCredentials: true });
    src.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { type: string };
        if (ev.type === 'nodes-updated') { qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['nodes'] }); }
        if (ev.type === 'notifications') qc.invalidateQueries({ queryKey: ['notifications'] });
        if (ev.type === 'dashboard') qc.invalidateQueries({ queryKey: ['dashboard'] });
      } catch { /* ignore malformed events */ }
    };
    return () => src.close();
  }, [qc]);

  // auth guard
  useEffect(() => {
    const status = (me.error as { status?: number } | null)?.status;
    if (me.error && status === 401) navigate('/login');
  }, [me.error, navigate]);

  // Ctrl+K palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const logout = useMutation({
    mutationFn: () => post('/auth/logout'),
    onSuccess: () => { qc.clear(); navigate('/login'); },
  });

  const items = NAV.filter((n) => !n.perm || me.data?.permissions.includes(n.perm) || me.data?.role === 'OWNER');

  return (
    <div className="shell">
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawer ? 'open' : ''}`} aria-label="sidebar">
        <div className="brand">
          <div className="brand-logo"><Logo /></div>
          <div>
            <div className="brand-name">{BRAND.name}</div>
            <div className="brand-sub">{locale === 'fa' ? BRAND.taglineFa : BRAND.taglineEn}</div>
          </div>
        </div>
        <nav className="nav" aria-label="main navigation">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setDrawer(false)}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={n.icon} size={19} />
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="version-card">
            <div>
              <b style={{ fontSize: 12 }}>{BRAND.name}</b>
              <small>v{BRAND.version} · <span style={{ color: 'var(--success)' }}>●</span> {t('common.online')}</small>
            </div>
            <Logo size={22} />
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="menu"><Icon name="menu" size={20} /></button>
          <button className="searchbox" onClick={() => setPaletteOpen(true)} aria-label={t('search.placeholder')}>
            <Icon name="search" size={16} />
            <span style={{ fontSize: 12 }}>{t('search.placeholder')}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="top-actions">
            <button className="icon-btn" title={t('common.refresh')} onClick={() => { qc.invalidateQueries(); toast(t('common.refresh')); }} aria-label={t('common.refresh')}>
              <Icon name="refresh" size={18} />
            </button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setNotifOpen((v) => !v)} aria-label={t('common.notifications')}>
                <Icon name="bell" size={18} />
                {(notifs.data?.unread ?? 0) > 0 && <span className="dot" />}
              </button>
              {notifOpen && (
                <div className="pop">
                  <div className="pop-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {t('common.notifications')}
                    <button className="btn ghost sm" onClick={() => { post('/notifications/read-all').then(() => qc.invalidateQueries({ queryKey: ['notifications'] })); }}>
                      {t('common.markRead')}
                    </button>
                  </div>
                  {(notifs.data?.items.length ?? 0) === 0 && <div className="empty" style={{ padding: 18 }}><Icon name="bell" size={22} /><span>{t('common.noNotifications')}</span></div>}
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifs.data?.items.map((n) => (
                      <div className="pop-item" key={n.id} style={{ opacity: n.readAt ? 0.6 : 1 }}>
                        <span className={`act-icon ${n.type === 'node' ? 'amber' : n.type === 'security' ? 'red' : 'blue'}`}><Icon name={n.type === 'node' ? 'server' : n.type === 'security' ? 'shield' : 'bell'} size={15} /></span>
                        <div><b style={{ fontSize: 12 }}>{n.title}</b><small>{n.body} · {rel(n.createdAt)}</small></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')} aria-label="language" title="FA / EN">
              <Icon name="globe" size={18} />
            </button>
            <div style={{ position: 'relative' }}>
              <button className="profile-chip" onClick={() => setProfileOpen((v) => !v)} aria-label="profile">
                <span className="avatar">{(me.data?.displayName ?? '?').slice(0, 1)}</span>
                <span className="meta"><b>{me.data?.displayName}</b><small>{me.data?.role}</small></span>
                <Icon name="chevron" size={14} />
              </button>
              {profileOpen && (
                <div className="pop" style={{ width: 210 }}>
                  <button className="palette-item" onClick={() => { setProfileOpen(false); navigate('/settings'); }}>
                    <Icon name="settings" size={16} /> {t('nav.settings')}
                  </button>
                  <button className="palette-item" onClick={() => logout.mutate()} style={{ color: 'var(--danger)' }}>
                    <Icon name="logout" size={16} /> {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Suspense fallback={<div className="skel-rows"><div className="skeleton" style={{ height: 90 }} /><div className="skeleton" style={{ height: 220 }} /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {paletteOpen && <SearchPalette onClose={() => setPaletteOpen(false)} />}
      {(notifOpen || profileOpen) && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => { setNotifOpen(false); setProfileOpen(false); }} />}
    </div>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const results = useQuery({
    queryKey: ['search', q],
    queryFn: () => get<{ users: { id: string; username: string }[]; configs: { id: string; name: string }[]; nodes: { id: string; name: string }[]; subscriptions: { id: string; username: string }[]; plans: { id: string; name: string }[] }>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });
  const groups = useMemo(() => {
    const d = results.data;
    if (!d) return [];
    return [
      { label: t('nav.users'), items: d.users.map((u) => ({ id: u.id, label: u.username, to: `/users/${u.id}` })) },
      { label: t('nav.configs'), items: d.configs.map((c) => ({ id: c.id, label: c.name, to: '/configs' })) },
      { label: t('nav.nodes'), items: d.nodes.map((n) => ({ id: n.id, label: n.name, to: '/nodes' })) },
      { label: t('nav.subscriptions'), items: d.subscriptions.map((s) => ({ id: s.id, label: s.username, to: '/subscriptions' })) },
      { label: t('nav.plans'), items: d.plans.map((p) => ({ id: p.id, label: p.name, to: '/plans' })) },
    ].filter((g) => g.items.length > 0);
  }, [results.data, t]);

  return (
    <div className="palette" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette-box" role="dialog" aria-modal="true" aria-label={t('common.search')}>
        <div className="palette-input">
          <Icon name="search" size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('common.search')} />
          <kbd style={{ fontSize: 10, color: 'var(--muted-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>ESC</kbd>
        </div>
        <div className="palette-results">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="palette-group">{g.label}</div>
              {g.items.map((i) => (
                <button key={i.id} className="palette-item" onClick={() => { onClose(); navigate(i.to); }}>
                  <Icon name="link" size={14} /> {i.label}
                </button>
              ))}
            </div>
          ))}
          {q.length >= 2 && groups.length === 0 && <div className="empty" style={{ padding: 22 }}>{t('common.empty')}</div>}
        </div>
      </div>
    </div>
  );
}
