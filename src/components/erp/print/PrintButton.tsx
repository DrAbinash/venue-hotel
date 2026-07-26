'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print-hide"
      style={{
        position: 'fixed', top: 16, right: 16, padding: '10px 22px',
        background: '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer',
        letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 12,
      }}
    >
      Print
    </button>
  );
}
