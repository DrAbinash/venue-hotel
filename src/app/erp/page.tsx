import type { Metadata } from 'next';
import ErpApp from '@/components/erp/ErpApp';

export const metadata: Metadata = {
  title: 'Staff Login — Hotel ERP',
  description: 'Property management system for hotel staff.',
  robots: { index: false, follow: false },
};

/**
 * /erp — the staff ERP. A client-side app that manages its own session, so
 * this route renders nothing but the shell.
 */
export default function ErpPage() {
  return <ErpApp />;
}
