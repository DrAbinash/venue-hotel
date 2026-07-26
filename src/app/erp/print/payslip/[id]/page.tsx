import { db } from '@/lib/db';
import { getStaffSession } from '@/lib/erp/auth';
import { getErpSettings } from '@/lib/erp/settings';
import { getSettings } from '@/lib/settings';
import { amountInWordsINR } from '@/lib/erp/gst';
import PrintButton from '@/components/erp/print/PrintButton';

export const dynamic = 'force-dynamic';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Printable monthly payslip with the full Indian statutory breakdown. */
export default async function PayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) {
    return <div className="doc"><p>Staff sign-in required. <a href="/erp">Go to staff login</a>.</p></div>;
  }

  const { id } = await params;
  const slip = await db.payslip.findUnique({
    where: { id },
    include: { employee: true, run: true },
  });
  if (!slip) return <div className="doc"><p>Payslip not found.</p></div>;

  const [erp, site] = await Promise.all([getErpSettings(), getSettings()]);
  const hotelName = erp.erpLegalName || site.hotelName || 'Hotel';
  const employee = slip.employee;

  const earnings: [string, number][] = [
    ['Basic', slip.basic],
    ['HRA', slip.hra],
    ['Other Allowances', slip.otherAllowances],
    ...(slip.otPay > 0 ? [['Overtime', slip.otPay] as [string, number]] : []),
  ];
  const deductions: [string, number][] = [
    ['Provident Fund (EPF)', slip.pfEmployee],
    ['ESI', slip.esiEmployee],
    ['Professional Tax', slip.pt],
    ['TDS', slip.tds],
    ['Advance Recovery', slip.advanceRecovery],
    ...(slip.otherDeductions > 0 ? [['Other Deductions', slip.otherDeductions] as [string, number]] : []),
  ];

  return (
    <div className="doc">
      <PrintButton />

      <div style={{ textAlign: 'center' }}>
        <h1>{hotelName}</h1>
        {erp.erpAddress && <p className="muted" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{erp.erpAddress}</p>}
        <p style={{ margin: '10px 0 0' }}><span className="tag">Payslip — {slip.month}</span></p>
        {slip.run.status !== 'finalized' && <p style={{ color: '#b45309', margin: '6px 0 0' }}>DRAFT — payroll not finalized</p>}
      </div>

      <div className="rule" />

      <table style={{ marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ paddingLeft: 0, verticalAlign: 'top' }}>
              <p style={{ margin: 0 }}><strong>{employee.name}</strong> ({employee.empCode})</p>
              <p className="muted" style={{ margin: 0 }}>{employee.designation ?? ''} · {employee.department.replace(/_/g, ' ')}</p>
              <p className="muted" style={{ margin: 0 }}>DOJ: {employee.doj ?? '—'}</p>
            </td>
            <td style={{ textAlign: 'right', paddingRight: 0, verticalAlign: 'top' }}>
              <p className="muted" style={{ margin: 0 }}>PAN: {employee.pan ?? '—'} · UAN: {employee.uan ?? '—'}</p>
              <p className="muted" style={{ margin: 0 }}>ESI: {employee.esiNumber ?? '—'}</p>
              <p className="muted" style={{ margin: 0 }}>
                Bank: {employee.bankName ?? '—'} {employee.bankAccount ? `A/c ${employee.bankAccount}` : ''} {employee.bankIfsc ?? ''}
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ margin: '0 0 8px' }}>
        Days: <strong>{slip.payableDays}</strong> payable of {slip.monthDays}
        {slip.lopDays > 0 && <> · Loss of Pay: <strong style={{ color: '#b91c1c' }}>{slip.lopDays}</strong></>}
      </p>

      <table className="grid-table">
        <thead>
          <tr><th>Earnings</th><th className="num">₹</th><th>Deductions</th><th className="num">₹</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(earnings.length, deductions.length) }).map((_, i) => (
            <tr key={i}>
              <td>{earnings[i]?.[0] ?? ''}</td>
              <td className="num">{earnings[i] ? fmt(earnings[i][1]) : ''}</td>
              <td>{deductions[i]?.[0] ?? ''}</td>
              <td className="num">{deductions[i] ? fmt(deductions[i][1]) : ''}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>Gross Earnings</td>
            <td className="num" style={{ fontWeight: 700 }}>{fmt(slip.grossEarned)}</td>
            <td style={{ fontWeight: 700 }}>Total Deductions</td>
            <td className="num" style={{ fontWeight: 700 }}>{fmt(slip.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: 16, margin: '14px 0 2px' }}><strong>Net Pay: ₹{fmt(slip.netPay)}</strong></p>
      <p className="muted" style={{ margin: 0 }}><em>{amountInWordsINR(slip.netPay)}</em></p>
      <p className="muted" style={{ margin: '10px 0 0', fontSize: 11 }}>
        Employer contributions (not deducted from salary): EPF ₹{fmt(slip.pfEmployer)} · ESI ₹{fmt(slip.esiEmployer)}
        {slip.paidOn && <> · Paid on {slip.paidOn.toISOString().slice(0, 10)}{slip.paymentRef ? ` (ref ${slip.paymentRef})` : ''}</>}
      </p>

      <div className="sig">
        <div>Employee</div>
        <div>For {hotelName}<br />Authorised Signatory</div>
      </div>
      <p className="muted" style={{ marginTop: 24, fontSize: 11, textAlign: 'center' }}>
        This is a computer generated payslip.
      </p>
    </div>
  );
}
