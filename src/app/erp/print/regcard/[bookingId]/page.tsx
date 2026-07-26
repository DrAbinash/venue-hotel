import { db } from '@/lib/db';
import { getStaffSession } from '@/lib/erp/auth';
import { getErpSettings } from '@/lib/erp/settings';
import { getSettings } from '@/lib/settings';
import { formatDate } from '@/lib/erp/dates';
import PrintButton from '@/components/erp/print/PrintButton';

export const dynamic = 'force-dynamic';

/**
 * Printable guest registration card — the physical register page the guest
 * signs at check-in, and the hotel's record for police verification.
 */
export default async function RegCardPrintPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await getStaffSession();
  if (!session) {
    return <div className="doc"><p>Staff sign-in required. <a href="/erp">Go to staff login</a>.</p></div>;
  }

  const { bookingId } = await params;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { regCard: true, unit: true, room: true },
  });
  if (!booking || !booking.regCard) return <div className="doc"><p>Registration card not found.</p></div>;
  const reg = booking.regCard;

  const [erp, site] = await Promise.all([getErpSettings(), getSettings()]);
  const hotelName = erp.erpLegalName || site.hotelName || 'Hotel';

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <tr>
      <td style={{ width: '32%', color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', border: '1px solid #bbb' }}>{label}</td>
      <td style={{ border: '1px solid #bbb' }}>{value ?? '—'}</td>
    </tr>
  );

  return (
    <div className="doc">
      <PrintButton />
      <div style={{ textAlign: 'center' }}>
        <h1>{hotelName}</h1>
        {erp.erpAddress && <p className="muted" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{erp.erpAddress}</p>}
        <p style={{ margin: '10px 0 0' }}>
          <span className="tag">Guest Registration Card{reg.isForeigner ? ' · Foreign National (Form C)' : ''}</span>
        </p>
      </div>

      <div className="rule" />

      <table>
        <tbody>
          <Row label="Guest Name" value={<strong>{reg.guestName}</strong>} />
          <Row label="Booking Ref / Room" value={`${booking.bookingRef} · Room ${booking.unit?.unitNumber ?? '—'} (${booking.roomType})`} />
          <Row label="Arrival / Departure" value={`${formatDate(booking.checkIn)} ${erp.erpCheckInTime} → ${formatDate(booking.checkOut)} ${erp.erpCheckOutTime}`} />
          <Row label="Guests" value={`${booking.adults} adult(s), ${booking.children} child(ren)`} />
          <Row label="Phone / Email" value={`${booking.guestPhone}${booking.guestEmail && !booking.guestEmail.endsWith('@frontdesk.local') ? ` · ${booking.guestEmail}` : ''}`} />
          <Row label="Nationality" value={reg.nationality} />
          <Row label="ID Proof" value={`${reg.idType.replace(/_/g, ' ').toUpperCase()} — ${reg.idNumber || '—'}`} />
          <Row label="Address" value={[reg.address, reg.city, reg.state, reg.pincode].filter(Boolean).join(', ')} />
          <Row label="Arriving From / Going To" value={`${reg.arrivalFrom ?? '—'} / ${reg.nextDestination ?? '—'}`} />
          <Row label="Purpose of Visit" value={reg.purposeOfVisit} />
          {reg.vehicleNo && <Row label="Vehicle No" value={reg.vehicleNo} />}
        </tbody>
      </table>

      {reg.isForeigner && (
        <>
          <p style={{ margin: '14px 0 6px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Form C Particulars (FRRO)</p>
          <table>
            <tbody>
              <Row label="Passport No" value={reg.passportNo} />
              <Row label="Passport Issued At / On" value={`${reg.passportIssuePlace ?? '—'} / ${reg.passportIssueDate ?? '—'}`} />
              <Row label="Passport Valid Till" value={reg.passportExpiry} />
              <Row label="Visa No / Type" value={`${reg.visaNo ?? '—'} / ${reg.visaType ?? '—'}`} />
              <Row label="Visa Valid Till" value={reg.visaExpiry} />
              <Row label="Arrived From (Country)" value={reg.arrivedFromCountry} />
              <Row label="Date of Arrival in India" value={reg.arrivalDateInIndia} />
              <Row label="FRRO Reference" value={reg.formCRef ?? 'Pending — file within 24h at indianfrro.gov.in'} />
            </tbody>
          </table>
        </>
      )}

      <p className="muted" style={{ marginTop: 14, fontSize: 11 }}>
        I certify that the above particulars are true. I agree to abide by hotel policies; check-out time is {erp.erpCheckOutTime}.
        I consent to my details being maintained in the hotel guest register as required under applicable law.
      </p>

      <div className="sig">
        <div>Guest Signature</div>
        <div>Front Desk ({reg.checkedInBy})</div>
      </div>
    </div>
  );
}
