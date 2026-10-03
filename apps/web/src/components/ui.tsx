import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons.js';
import { useI18n } from '../lib/i18n.js';

/* ---------- Toasts ---------- */
interface Toast { id: number; text: string; kind: 'success' | 'error' }
const ToastCtx = createContext<(text: string, kind?: 'success' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'success' ? 'check' : 'warn'} size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={wide ? { width: 'min(760px, 100%)' } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="close"><Icon name="x" size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, onCancel, onConfirm, busy, danger = true }: {
  open: boolean; title: string; body: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; danger?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>{body}</p>
      <div className="modal-foot">
        <button className="btn secondary" onClick={onCancel}>{t('common.cancel')}</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={onConfirm}>
          {busy ? t('common.loading') : t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- States ---------- */
export function Empty({ icon = 'docs' }: { icon?: string }) {
  const { t } = useI18n();
  return <div className="empty"><Icon name={icon} size={34} /><span>{t('common.empty')}</span></div>;
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="error-state">
      <Icon name="warn" size={30} />
      <span>{t('common.error')}</span>
      {onRetry && <button className="btn secondary sm" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

export function SkelRows({ n = 4 }: { n?: number }) {
  return <div className="skel-rows">{Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" />)}</div>;
}

/* ---------- Badge ---------- */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    active: 'green', online: 'green', success: 'green', healthy: 'green',
    suspended: 'red', revoked: 'red', offline: 'red', critical: 'red', denied: 'red', error: 'red', disabled: 'red',
    expired: 'amber', degraded: 'amber', starting: 'blue', maintenance: 'gray', warning: 'amber', unknown: 'gray',
  };
  const label = (t as (k: never) => string)(`common.${status}` as never);
  return <span className={`badge ${map[status] ?? 'gray'}`}>{label.startsWith('common.') ? status : label}</span>;
}

/* ---------- Pager ---------- */
export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const { t, num } = useI18n();
  if (totalPages <= 1) return null;
  return (
    <div className="pager">
      <span>{t('common.page')} {num(page)} {t('common.of')} {num(totalPages)}</span>
      <button className="btn secondary sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
      <button className="btn secondary sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}

/* ---------- Traffic progress ---------- */
export function TrafficBar({ used, quota }: { used: number; quota: number }) {
  const { bytes } = useI18n();
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  return (
    <div style={{ minWidth: 110 }}>
      <div className="meter-label"><span>{bytes(used)}</span><span>{quota > 0 ? bytes(quota) : '∞'}</span></div>
      <div className="progress"><span style={{ width: `${pct}%`, background: pct > 90 ? 'var(--danger)' : undefined }} /></div>
    </div>
  );
}

/* ---------- Copy button ---------- */
export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <button className="btn ghost sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be unavailable */ }
      toast(t('common.copied'));
    }}>
      <Icon name="copy" size={14} />{label ?? t('common.copy')}
    </button>
  );
}
