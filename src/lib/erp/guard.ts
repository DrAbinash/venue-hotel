import { requireErp } from '@/lib/erp/auth';
import { ensureErpReady } from '@/lib/erp/bootstrap';
import type { ErpModule } from '@/lib/erp/perms';

/**
 * Standard entry for every ERP route handler: run the (memoised) readiness
 * pass, then authenticate and authorise.
 *
 *   const auth = await erpGuard('frontdesk');
 *   if (auth.denied) return auth.denied;
 */
export async function erpGuard(module?: ErpModule) {
  await ensureErpReady();
  return requireErp(module);
}
