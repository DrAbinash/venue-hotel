'use client';

import AdminPanel from '@/components/admin/AdminPanel';

/**
 * /admin — the panel loads its own data once a session is established, so
 * this route does not fetch anything itself.
 */
export default function AdminPage() {
  return <AdminPanel />;
}
