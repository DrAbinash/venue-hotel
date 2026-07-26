/**
 * Shared chrome for printable ERP documents (invoices, payslips, reg cards):
 * plain white, ink-friendly, A4-width column.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', minHeight: '100vh', color: '#111' }}>
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          body { background: #fff; }
          @page { margin: 12mm; }
        }
        .doc {
          max-width: 190mm; margin: 0 auto; padding: 24px 20px;
          font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.45;
        }
        .doc table { width: 100%; border-collapse: collapse; }
        .doc th, .doc td { padding: 6px 8px; }
        .doc .grid-table th, .doc .grid-table td { border: 1px solid #999; }
        .doc .grid-table th { background: #f3ede2; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
        .doc .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .doc h1 { font-size: 20px; letter-spacing: 0.18em; text-transform: uppercase; margin: 0; font-weight: 400; }
        .doc .muted { color: #555; }
        .doc .rule { border-top: 2px solid #1a1a1a; margin: 10px 0; }
        .doc .tag { display: inline-block; border: 1px solid #999; padding: 1px 8px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
        .doc .sig { display: flex; justify-content: space-between; margin-top: 56px; gap: 24px; }
        .doc .sig div { border-top: 1px solid #777; padding-top: 4px; width: 200px; text-align: center; font-size: 11px; color: #444; }
      `}</style>
      {children}
    </div>
  );
}
