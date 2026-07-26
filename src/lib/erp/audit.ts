import { db } from '@/lib/db';
import type { StaffSession } from '@/lib/erp/auth';

/**
 * Append-only trail of who did what. Failures are swallowed — an audit
 * hiccup must never fail the operation it was recording.
 */
export async function logAudit(
  session: StaffSession | { username: string; uid?: string },
  action: string,
  details: { entity?: string; entityId?: string; summary: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: 'uid' in session ? session.uid ?? null : null,
        username: session.username,
        action,
        entity: details.entity ?? null,
        entityId: details.entityId ?? null,
        summary: details.summary.slice(0, 500),
        meta: JSON.stringify(details.meta ?? {}),
      },
    });
  } catch (error) {
    console.error('audit log failed', action, error);
  }
}
