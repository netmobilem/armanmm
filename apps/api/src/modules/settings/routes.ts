import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, systemSettings } from '@vira/db';
import { requirePermission, assertCsrf } from '../../plugins/auth.js';
import { audit } from '../../lib/audit.js';
import { BRAND } from '@vira/shared';

const DEFAULTS: Record<string, unknown> = {
  general: { productName: BRAND.name, supportUrl: '', announcement: '' },
  branding: { accent: BRAND.accent.primary, logoText: BRAND.shortName },
  security: { loginLockoutThreshold: 5, sessionTtlHours: 168 },
  subscriptions: { defaultQuotaGb: 0, warnBeforeExpiryDays: 7 },
  nodes: { offlineThresholdSeconds: 90 },
  localization: { defaultLanguage: 'fa' },
};

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', async (req) => {
    await requirePermission(req, 'settings.read');
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, 'panel'));
    const stored = (rows[0]?.value as Record<string, unknown>) ?? {};
    return { success: true, requestId: req.id, data: { ...DEFAULTS, ...stored } };
  });

  app.patch('/settings', async (req) => {
    const auth = await requirePermission(req, 'settings.update');
    assertCsrf(req, auth);
    const body = z.record(z.string(), z.record(z.string(), z.unknown())).parse(req.body ?? {});
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, 'panel'));
    const stored = (rows[0]?.value as Record<string, Record<string, unknown>>) ?? {};
    for (const [section, values] of Object.entries(body)) {
      stored[section] = { ...(stored[section] ?? {}), ...values };
    }
    await db.insert(systemSettings).values({ key: 'panel', value: stored })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: stored, updatedAt: new Date() } });
    audit(req, { actorId: auth.accountId, actorName: auth.username, action: 'SETTINGS_UPDATED', resourceType: 'settings', metadata: { sections: Object.keys(body) } });
    return { success: true, requestId: req.id, data: { ...DEFAULTS, ...stored } };
  });
}
