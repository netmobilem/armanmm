import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const en = {
  'nav.dashboard': 'Dashboard', 'nav.users': 'Users', 'nav.configs': 'Configurations', 'nav.nodes': 'Nodes',
  'nav.subscriptions': 'Subscriptions', 'nav.plans': 'Plans', 'nav.groups': 'Groups', 'nav.resellers': 'Resellers',
  'nav.reports': 'Reports', 'nav.activity': 'Activity', 'nav.apikeys': 'API Keys', 'nav.settings': 'Settings',
  'nav.admins': 'Admin Management', 'nav.audit': 'Audit Logs', 'nav.health': 'System Health',
  'common.search': 'Search…', 'common.create': 'Create', 'common.save': 'Save', 'common.cancel': 'Cancel',
  'common.delete': 'Delete', 'common.edit': 'Edit', 'common.actions': 'Actions', 'common.status': 'Status',
  'common.name': 'Name', 'common.loading': 'Loading…', 'common.empty': 'Nothing here yet',
  'common.error': 'Something went wrong', 'common.retry': 'Retry', 'common.confirm': 'Confirm',
  'common.viewAll': 'View all', 'common.username': 'Username', 'common.password': 'Password',
  'common.login': 'Sign in', 'common.logout': 'Logout', 'common.active': 'Active', 'common.suspended': 'Suspended',
  'common.expired': 'Expired', 'common.online': 'Online', 'common.offline': 'Offline', 'common.degraded': 'Degraded',
  'common.starting': 'Starting', 'common.maintenance': 'Maintenance', 'common.revoked': 'Revoked',
  'common.disabled': 'Disabled', 'common.copy': 'Copy', 'common.copied': 'Copied', 'common.days': 'days',
  'common.left': 'left', 'common.total': 'Total', 'common.used': 'Used', 'common.remaining': 'Remaining',
  'common.page': 'Page', 'common.of': 'of', 'common.close': 'Close', 'common.refresh': 'Refresh',
  'common.notifications': 'Notifications', 'common.markRead': 'Mark all read', 'common.noNotifications': 'No notifications',
  'dash.greeting': 'Welcome back', 'dash.subtitle': 'Overview of services and your panel statistics',
  'dash.activeUsers': 'Active Users', 'dash.activeConfigs': 'Active Configs', 'dash.totalTraffic': 'Total Traffic',
  'dash.activeSubs': 'Active Subscriptions', 'dash.onlineNodes': 'Online Nodes', 'dash.expiringSoon': 'Expiring Soon',
  'dash.trafficOverview': 'Traffic Overview', 'dash.nodeStatus': 'Node Status', 'dash.recentUsers': 'Recent Users',
  'dash.recentActivity': 'Recent Activity', 'dash.configStats': 'Config Statistics', 'dash.subStats': 'Subscription Statistics',
  'dash.systemHealth': 'System Health', 'dash.last7': 'Last 7 days', 'dash.cpu': 'CPU', 'dash.mem': 'Memory',
  'dash.traffic': 'Traffic', 'dash.connections': 'Connections',
  'users.title': 'Users', 'users.create': 'Create User', 'users.traffic': 'Traffic', 'users.expire': 'Expires',
  'users.lastActive': 'Last activity', 'users.tags': 'Tags', 'users.notes': 'Notes', 'users.bulk': 'Bulk actions',
  'users.suspend': 'Suspend', 'users.activate': 'Activate', 'users.assignGroup': 'Assign group',
  'users.confirmDelete': 'Delete this user? This revokes access and soft-deletes the record.',
  'users.overview': 'Overview', 'users.subscriptions': 'Subscriptions', 'users.configs': 'Configurations',
  'users.activity': 'Activity', 'users.quota': 'Traffic quota', 'users.plan': 'Plan', 'users.group': 'Group',
  'configs.title': 'Configurations', 'configs.create': 'New Configuration', 'configs.protocol': 'Protocol',
  'configs.transport': 'Transport', 'configs.security': 'Security', 'configs.node': 'Node', 'configs.port': 'Port',
  'configs.link': 'Link', 'configs.revoke': 'Revoke', 'configs.rotate': 'Rotate credential', 'configs.versions': 'Versions',
  'configs.preview': 'Preview', 'wizard.basic': 'Basic info', 'wizard.advanced': 'Advanced', 'wizard.review': 'Review',
  'nodes.title': 'Nodes', 'nodes.create': 'Add Node', 'nodes.location': 'Location', 'nodes.address': 'Address',
  'nodes.latency': 'Latency', 'nodes.heartbeat': 'Last heartbeat', 'nodes.test': 'Test connection',
  'nodes.agentToken': 'Issue agent token', 'nodes.agentTokenHint': 'Shown once — store it securely on the node.',
  'nodes.confirmDelete': 'Delete this node? Attached configurations will be removed.',
  'subs.title': 'Subscriptions', 'subs.create': 'New Subscription', 'subs.renew': 'Renew', 'subs.revoke': 'Revoke',
  'subs.resetTraffic': 'Reset traffic', 'subs.regenToken': 'Regenerate token', 'subs.token': 'Token',
  'subs.confirmRevoke': 'Revoke this subscription? The user loses access immediately.',
  'plans.title': 'Plans', 'plans.create': 'New Plan', 'plans.duration': 'Duration (days)', 'plans.price': 'Price',
  'plans.traffic': 'Traffic limit',
  'groups.title': 'Configuration Groups', 'groups.create': 'New Group', 'groups.protocols': 'Allowed protocols',
  'resellers.title': 'Resellers', 'resellers.create': 'New Reseller', 'resellers.users': 'Users',
  'resellers.maxUsers': 'User limit',
  'apikeys.title': 'API Keys', 'apikeys.create': 'Create API Key', 'apikeys.scopes': 'Scopes',
  'apikeys.secretHint': 'Copy this secret now — it will not be shown again.',
  'apikeys.confirmRevoke': 'Revoke this API key? Integrations using it will stop working.',
  'audit.title': 'Audit Logs', 'audit.action': 'Action', 'audit.actor': 'Actor', 'audit.result': 'Result', 'audit.ip': 'IP',
  'activity.title': 'Activity Center',
  'reports.title': 'Reports', 'reports.traffic': 'Traffic', 'reports.users': 'Users', 'reports.subscriptions': 'Subscriptions',
  'reports.nodes': 'Nodes', 'reports.configs': 'Configurations', 'reports.exportCsv': 'Export CSV', 'reports.from': 'From', 'reports.to': 'To',
  'settings.title': 'Settings', 'settings.general': 'General', 'settings.branding': 'Branding', 'settings.security': 'Security',
  'settings.subscriptions': 'Subscriptions', 'settings.nodes': 'Nodes', 'settings.localization': 'Localization',
  'admins.title': 'Admin Management', 'admins.create': 'Create Admin', 'admins.role': 'Role',
  'admins.resetPassword': 'Reset password', 'admins.revokeSessions': 'Revoke sessions',
  'health.title': 'System Health', 'health.component': 'Component', 'health.status': 'Status', 'health.healthy': 'Healthy',
  'health.warning': 'Warning', 'health.critical': 'Critical', 'health.unknown': 'Unknown',
  'sub.pageTitle': 'Your Subscription', 'sub.apps': 'Client apps', 'sub.copyAll': 'Copy all links', 'sub.qr': 'QR',
  'sub.inactive': 'This subscription is not active.', 'sub.subUrl': 'Subscription URL',
  'login.title': 'Sign in to your panel', 'login.devHint': 'Development credentials',
  'search.placeholder': 'Search users, configs, nodes…',
};

const fa: typeof en = {
  'nav.dashboard': 'داشبورد', 'nav.users': 'کاربران', 'nav.configs': 'کانفیگ‌ها', 'nav.nodes': 'سرورها',
  'nav.subscriptions': 'اشتراک‌ها', 'nav.plans': 'پلن‌ها', 'nav.groups': 'گروه‌ها', 'nav.resellers': 'نمایندگان',
  'nav.reports': 'گزارش‌ها', 'nav.activity': 'فعالیت‌ها', 'nav.apikeys': 'کلیدهای API', 'nav.settings': 'تنظیمات',
  'nav.admins': 'مدیریت ادمین‌ها', 'nav.audit': 'لاستیزی رویدادها', 'nav.health': 'سلامت سامانه',
  'common.search': 'جستجو…', 'common.create': 'ایجاد', 'common.save': 'ذخیره', 'common.cancel': 'انصراف',
  'common.delete': 'حذف', 'common.edit': 'ویرایش', 'common.actions': 'عملیات', 'common.status': 'وضعیت',
  'common.name': 'نام', 'common.loading': 'در حال بارگذاری…', 'common.empty': 'موردی یافت نشد',
  'common.error': 'خطایی رخ داد', 'common.retry': 'تلاش مجدد', 'common.confirm': 'تأیید',
  'common.viewAll': 'مشاهده همه', 'common.username': 'نام کاربری', 'common.password': 'رمز عبور',
  'common.login': 'ورود', 'common.logout': 'خروج', 'common.active': 'فعال', 'common.suspended': 'معلق',
  'common.expired': 'منقضی', 'common.online': 'آنلاین', 'common.offline': 'آفلاین', 'common.degraded': 'ناپایدار',
  'common.starting': 'در حال راه‌اندازی', 'common.maintenance': 'تعمیر', 'common.revoked': 'باطل شده',
  'common.disabled': 'غیرفعال', 'common.copy': 'کپی', 'common.copied': 'کپی شد', 'common.days': 'روز',
  'common.left': 'مانده', 'common.total': 'کل', 'common.used': 'مصرف', 'common.remaining': 'باقی‌مانده',
  'common.page': 'صفحه', 'common.of': 'از', 'common.close': 'بستن', 'common.refresh': 'به‌روزرسانی',
  'common.notifications': 'اعلان‌ها', 'common.markRead': 'خواندن همه', 'common.noNotifications': 'اعلانی نیست',
  'dash.greeting': 'خوش آمدید', 'dash.subtitle': 'نمای کلی وضعیت سرویس‌ها و آمار پنل شما',
  'dash.activeUsers': 'کاربران فعال', 'dash.activeConfigs': 'کانفیگ‌های فعال', 'dash.totalTraffic': 'کل ترافیک',
  'dash.activeSubs': 'اشتراک‌های فعال', 'dash.onlineNodes': 'سرورهای آنلاین', 'dash.expiringSoon': 'رو به انقضا',
  'dash.trafficOverview': 'نمودار ترافیک', 'dash.nodeStatus': 'وضعیت سرورها', 'dash.recentUsers': 'آخرین کاربران',
  'dash.recentActivity': 'آخرین فعالیت‌ها', 'dash.configStats': 'آمار کانفیگ‌ها', 'dash.subStats': 'آمار اشتراک‌ها',
  'dash.systemHealth': 'سلامت سامانه', 'dash.last7': '۷ روز گذشته', 'dash.cpu': 'پردازنده', 'dash.mem': 'حافظه',
  'dash.traffic': 'ترافیک', 'dash.connections': 'اتصال‌ها',
  'users.title': 'کاربران', 'users.create': 'ایجاد کاربر', 'users.traffic': 'ترافیک', 'users.expire': 'انقضا',
  'users.lastActive': 'آخرین فعالیت', 'users.tags': 'برچسب‌ها', 'users.notes': 'یادداشت', 'users.bulk': 'عملیات گروهی',
  'users.suspend': 'تعلیق', 'users.activate': 'فعال‌سازی', 'users.assignGroup': 'اختصاص گروه',
  'users.confirmDelete': 'این کاربر حذف شود؟ دسترسی او باطل و رکورد به‌صورت نرم حذف می‌شود.',
  'users.overview': 'نمای کلی', 'users.subscriptions': 'اشتراک‌ها', 'users.configs': 'کانفیگ‌ها',
  'users.activity': 'فعالیت', 'users.quota': 'سهم ترافیک', 'users.plan': 'پلن', 'users.group': 'گروه',
  'configs.title': 'کانفیگ‌ها', 'configs.create': 'کانفیگ جدید', 'configs.protocol': 'پروتکل',
  'configs.transport': 'انتقال', 'configs.security': 'امنیت', 'configs.node': 'سرور', 'configs.port': 'پورت',
  'configs.link': 'لینک', 'configs.revoke': 'باطل‌سازی', 'configs.rotate': 'تغییر اعتبار', 'configs.versions': 'نسخه‌ها',
  'configs.preview': 'پیش‌نمایش', 'wizard.basic': 'اطلاعات پایه', 'wizard.advanced': 'تنظیمات پیشرفته', 'wizard.review': 'بازبینی',
  'nodes.title': 'سرورها', 'nodes.create': 'افزودن سرور', 'nodes.location': 'موقعیت', 'nodes.address': 'آدرس',
  'nodes.latency': 'تأخیر', 'nodes.heartbeat': 'آخرین ضربان', 'nodes.test': 'تست اتصال',
  'nodes.agentToken': 'صدور توکن ایجنت', 'nodes.agentTokenHint': 'فقط یک‌بار نمایش داده می‌شود — امن نگه دارید.',
  'nodes.confirmDelete': 'این سرور حذف شود؟ کانفیگ‌های متصل نیز حذف می‌شوند.',
  'subs.title': 'اشتراک‌ها', 'subs.create': 'اشتراک جدید', 'subs.renew': 'تمدید', 'subs.revoke': 'باطل‌سازی',
  'subs.resetTraffic': 'ریست ترافیک', 'subs.regenToken': 'توکن جدید', 'subs.token': 'توکن',
  'subs.confirmRevoke': 'این اشتراک باطل شود؟ دسترسی کاربر بلافاصله قطع می‌شود.',
  'plans.title': 'پلن‌ها', 'plans.create': 'پلن جدید', 'plans.duration': 'مدت (روز)', 'plans.price': 'قیمت',
  'plans.traffic': 'سقف ترافیک',
  'groups.title': 'گروه‌های کانفیگ', 'groups.create': 'گروه جدید', 'groups.protocols': 'پروتکل‌های مجاز',
  'resellers.title': 'نمایندگان فروش', 'resellers.create': 'نماینده جدید', 'resellers.users': 'کاربران',
  'resellers.maxUsers': 'سقف کاربر',
  'apikeys.title': 'کلیدهای API', 'apikeys.create': 'ایجاد کلید', 'apikeys.scopes': 'اختیارات',
  'apikeys.secretHint': 'این secret را اکنون کپی کنید — دیگر نمایش داده نمی‌شود.',
  'apikeys.confirmRevoke': 'این کلید باطل شود؟ یکپارچه‌سازی‌های وابسته متوقف می‌شوند.',
  'audit.title': 'رویدادهای سیستم', 'audit.action': 'رویداد', 'audit.actor': 'عامل', 'audit.result': 'نتیجه', 'audit.ip': 'IP',
  'activity.title': 'مرکز فعالیت',
  'reports.title': 'گزارش‌ها', 'reports.traffic': 'ترافیک', 'reports.users': 'کاربران', 'reports.subscriptions': 'اشتراک‌ها',
  'reports.nodes': 'سرورها', 'reports.configs': 'کانفیگ‌ها', 'reports.exportCsv': 'خروجی CSV', 'reports.from': 'از', 'reports.to': 'تا',
  'settings.title': 'تنظیمات', 'settings.general': 'عمومی', 'settings.branding': 'برندینگ', 'settings.security': 'امنیت',
  'settings.subscriptions': 'اشتراک', 'settings.nodes': 'سرورها', 'settings.localization': 'زبان',
  'admins.title': 'مدیریت ادمین‌ها', 'admins.create': 'ایجاد ادمین', 'admins.role': 'نقش',
  'admins.resetPassword': 'ریست رمز', 'admins.revokeSessions': 'ابطال نشست‌ها',
  'health.title': 'سلامت سامانه', 'health.component': 'جزء', 'health.status': 'وضعیت', 'health.healthy': 'سالم',
  'health.warning': 'هشدار', 'health.critical': 'بحرانی', 'health.unknown': 'نامشخص',
  'sub.pageTitle': 'اشتراک شما', 'sub.apps': 'اپلیکیشن‌ها', 'sub.copyAll': 'کپی همه لینک‌ها', 'sub.qr': 'QR',
  'sub.inactive': 'این اشتراک فعال نیست.', 'sub.subUrl': 'لینک اشتراک',
  'login.title': 'ورود به پنل مدیریت', 'login.devHint': 'اطلاعات ورود توسعه',
  'search.placeholder': 'جستجوی کاربر، کانفیگ، سرور…',
};

export type Locale = 'fa' | 'en';
const dicts: Record<Locale, typeof en> = { fa, en };
export type TKey = keyof typeof en;

interface I18n {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: (k: TKey) => string;
  setLocale: (l: Locale) => void;
  num: (n: number) => string;
  bytes: (n: number) => string;
  date: (iso: string | null) => string;
  rel: (iso: string | null) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => (localStorage.getItem('vira-locale') as Locale) || 'fa');
  const dir: 'rtl' | 'ltr' = locale === 'fa' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  const setLocale = useCallback((l: Locale) => { localStorage.setItem('vira-locale', l); setLocaleState(l); }, []);
  const t = useCallback((k: TKey) => dicts[locale][k] ?? en[k] ?? k, [locale]);
  const num = useCallback((n: number) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n), [locale]);
  const bytes = useCallback((n: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = n, i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    const s = v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, '');
    return `${new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(Number(s))} ${units[i]}`;
  }, [locale]);
  const date = useCallback((iso: string | null) => {
    if (!iso) return '—';
    return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium' }).format(new Date(iso));
  }, [locale]);
  const rel = useCallback((iso: string | null) => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return locale === 'fa' ? 'هم‌اکنون' : 'now';
    if (m < 60) return locale === 'fa' ? `${num(m)} دقیقه پیش` : `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return locale === 'fa' ? `${num(h)} ساعت پیش` : `${h}h ago`;
    const d = Math.round(h / 24);
    return locale === 'fa' ? `${num(d)} روز پیش` : `${d}d ago`;
  }, [locale, num]);
  const value = useMemo(() => ({ locale, dir, t, setLocale, num, bytes, date, rel }), [locale, dir, t, setLocale, num, bytes, date, rel]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('I18nProvider missing');
  return v;
}
