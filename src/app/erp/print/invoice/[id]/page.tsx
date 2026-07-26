import { db } from '@/lib/db';
import { getStaffSession } from '@/lib/erp/auth';
import { getErpSettings } from '@/lib/erp/settings';
import { getSettings } from '@/lib/settings';
import { formatDate } from '@/lib/erp/dates';
import PrintButton from '@/components/erp/print/PrintButton';

export const dynamic = 'force-dynamic';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

interface Line {
  description: string; hsnSac: string; qty: number; rate: number;
  taxable: number; gstRate: number; cgst: number; sgst: number; igst: number; total: number;
}

/** Printable GST tax invoice — the document a guest or company accountant keeps. */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) {
    return <div className="doc"><p>Staff sign-in required. <a href="/erp">Go to staff login</a>.</p></div>;
  }

  const { id } = await params;
  const invoice = await db.taxInvoice.findUnique({
    where: { id },
    include: { folio: { include: { booking: { include: { unit: true } } } } },
  });
  if (!invoice) return <div className="doc"><p>Invoice not found.</p></div>;

  const [erp, site] = await Promise.all([getErpSettings(), getSettings()]);
  const hotelName = erp.erpLegalName || site.hotelName || 'Hotel';
  let lines: Line[] = [];
  try { lines = JSON.parse(invoice.lines); } catch { lines = []; }
  const booking = invoice.folio?.booking;

  return (
    <div className="doc">
      <PrintButton />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{hotelName}</h1>
          {erp.erpAddress && <p className="muted" style={{ whiteSpace: 'pre-line', margin: '4px 0 0' }}>{erp.erpAddress}</p>}
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {erp.erpGstin && <>GSTIN: <strong>{erp.erpGstin}</strong></>}
            {erp.erpFssai && <> · FSSAI: {erp.erpFssai}</>}
            {site.phone && <> · {site.phone}</>}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="tag">{invoice.status === 'cancelled' ? 'CANCELLED' : 'Tax Invoice'}</span>
          <p style={{ margin: '8px 0 0', fontSize: 15 }}><strong>{invoice.invoiceNo}</strong></p>
          <p className="muted" style={{ margin: 0 }}>Date: {formatDate(invoice.issuedAt)}</p>
          <p className="muted" style={{ margin: 0 }}>FY {invoice.fy}</p>
        </div>
      </div>

      <div className="rule" />

      <table style={{ marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', paddingLeft: 0 }}>
              <p className="muted" style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Billed To</p>
              <p style={{ margin: '2px 0 0', fontSize: 14 }}><strong>{invoice.buyerName}</strong></p>
              {invoice.buyerAddress && <p className="muted" style={{ margin: 0 }}>{invoice.buyerAddress}</p>}
              {invoice.buyerGstin && <p style={{ margin: 0 }}>GSTIN: {invoice.buyerGstin}</p>}
              {invoice.placeOfSupply && <p className="muted" style={{ margin: 0 }}>Place of Supply: {invoice.placeOfSupply}</p>}
            </td>
            {booking && (
              <td style={{ verticalAlign: 'top', textAlign: 'right', paddingRight: 0 }}>
                <p className="muted" style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stay Details</p>
                <p style={{ margin: '2px 0 0' }}>Booking {booking.bookingRef}</p>
                <p className="muted" style={{ margin: 0 }}>
                  Room {booking.unit?.unitNumber ?? '—'} · {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}
                </p>
                <p className="muted" style={{ margin: 0 }}>{booking.adults} adult(s){booking.children ? `, ${booking.children} child(ren)` : ''}</p>
              </td>
            )}
          </tr>
        </tbody>
      </table>

      <table className="grid-table">
        <thead>
          <tr>
            <th>#</th><th>Particulars</th><th>SAC/HSN</th><th className="num">Qty</th>
            <th className="num">Rate</th><th className="num">Taxable</th><th className="num">GST %</th>
            <th className="num">CGST</th><th className="num">SGST</th><th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{line.description}</td>
              <td>{line.hsnSac}</td>
              <td className="num">{line.qty}</td>
              <td className="num">{fmt(line.rate)}</td>
              <td className="num">{fmt(line.taxable)}</td>
              <td className="num">{line.gstRate}%</td>
              <td className="num">{fmt(line.cgst)}</td>
              <td className="num">{fmt(line.sgst)}</td>
              <td className="num">{fmt(line.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ border: 'none' }} />
            <td className="num" style={{ fontWeight: 700 }}>{fmt(invoice.taxable)}</td>
            <td />
            <td className="num" style={{ fontWeight: 700 }}>{fmt(invoice.cgst)}</td>
            <td className="num" style={{ fontWeight: 700 }}>{fmt(invoice.sgst)}</td>
            <td className="num" style={{ fontWeight: 700 }}>{fmt(invoice.taxable + invoice.cgst + invoice.sgst + invoice.igst)}</td>
          </tr>
        </tfoot>
      </table>

      <table style={{ marginTop: 10 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', paddingLeft: 0 }}>
              <p style={{ margin: 0, fontSize: 12 }}><em>{invoice.amountInWords}</em></p>
              {invoice.irn && <p className="muted" style={{ margin: '4px 0 0', fontSize: 11 }}>IRN: {invoice.irn}</p>}
              {invoice.status === 'cancelled' && (
                <p style={{ margin: '4px 0 0', color: '#b91c1c' }}>Cancelled: {invoice.cancelReason}</p>
              )}
            </td>
            <td style={{ textAlign: 'right', paddingRight: 0, whiteSpace: 'nowrap' }}>
              {invoice.igst > 0 && <p style={{ margin: 0 }}>IGST: ₹{fmt(invoice.igst)}</p>}
              <p style={{ margin: 0 }}>Round Off: ₹{fmt(invoice.roundOff)}</p>
              <p style={{ margin: '4px 0 0', fontSize: 17 }}><strong>Grand Total: ₹{fmt(invoice.total)}</strong></p>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="sig">
        <div>Guest / Customer</div>
        <div>For {hotelName}<br />Authorised Signatory</div>
      </div>

      <p className="muted" style={{ marginTop: 28, fontSize: 11, textAlign: 'center' }}>
        {erp.erpInvoiceFooter}
      </p>
    </div>
  );
}
