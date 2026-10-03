import { useI18n } from '../lib/i18n.js';
import { AuditTable } from './Audit.js';

export default function Activity() {
  const { t } = useI18n();
  return (
    <>
      <h1 className="page-title">{t('activity.title')}</h1>
      <p className="page-sub"> </p>
      <AuditTable />
    </>
  );
}
