'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api, act, notify, notifyError } from '@/components/erp/lib';
import { Field, PageHeader, Section, Spinner } from '@/components/erp/ui';

/**
 * ERP configuration: statutory identity, GST slabs, front-office times and
 * payroll knobs. Everything ships with sensible Indian defaults and is
 * editable because rates and rules change.
 */
export default function ErpSettings() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSettings((await api<{ settings: Record<string, string> }>('/api/erp/settings')).settings); }
    catch (error) { notifyError(error); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!settings) return <Spinner />;

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings({ ...settings, [key]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      await act('/api/erp/settings', { settings });
      notify('ERP settings saved');
    } catch (error) { notifyError(error); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="ERP Settings" subtitle="Statutory identity, GST, front office and payroll"
        actions={
          <Button onClick={save} disabled={busy} className="bg-gold hover:bg-gold-dark text-white rounded-none">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save All</>}
          </Button>
        } />

      <div className="space-y-4">
        <Section title="Statutory Identity (printed on invoices)">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Legal / Registered Name"><Input value={settings.erpLegalName} placeholder="Hotel legal entity name" onChange={set('erpLegalName')} /></Field>
            <Field label="GSTIN"><Input value={settings.erpGstin} placeholder="21ABCDE1234F1Z5" onChange={set('erpGstin')} /></Field>
            <Field label="FSSAI Licence (F&B invoices)"><Input value={settings.erpFssai} onChange={set('erpFssai')} /></Field>
            <Field label="PAN"><Input value={settings.erpPan} onChange={set('erpPan')} /></Field>
            <Field label="State"><Input value={settings.erpStateName} onChange={set('erpStateName')} /></Field>
            <Field label="State Code (GST)"><Input value={settings.erpStateCode} placeholder="21" onChange={set('erpStateCode')} /></Field>
            <Field label="Registered Address" className="sm:col-span-2">
              <Textarea rows={2} value={settings.erpAddress} onChange={set('erpAddress')} />
            </Field>
            <Field label="Invoice Footer Note" className="sm:col-span-2">
              <Input value={settings.erpInvoiceFooter} onChange={set('erpInvoiceFooter')} />
            </Field>
          </div>
        </Section>

        <Section title="GST Rates & SAC Codes">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Room GST Slabs (JSON)" hint='Nightly tariff slabs, e.g. [{"upTo":7500,"rate":5},{"upTo":null,"rate":18}]' className="sm:col-span-2">
              <Input value={settings.erpRoomGstSlabs} onChange={set('erpRoomGstSlabs')} className="font-mono text-xs" />
            </Field>
            <Field label="Restaurant / F&B GST %"><Input type="number" value={settings.erpFnbGstRate} onChange={set('erpFnbGstRate')} /></Field>
            <Field label="Banquet Catering GST %"><Input type="number" value={settings.erpBanquetGstRate} onChange={set('erpBanquetGstRate')} /></Field>
            <Field label="Laundry GST %"><Input type="number" value={settings.erpLaundryGstRate} onChange={set('erpLaundryGstRate')} /></Field>
            <Field label="Minibar GST %"><Input type="number" value={settings.erpMinibarGstRate} onChange={set('erpMinibarGstRate')} /></Field>
            <Field label="Misc / Hall-Rent GST %"><Input type="number" value={settings.erpMiscGstRate} onChange={set('erpMiscGstRate')} /></Field>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <Field label="SAC — Rooms"><Input value={settings.erpSacRoom} onChange={set('erpSacRoom')} /></Field>
              <Field label="SAC — F&B"><Input value={settings.erpSacFnb} onChange={set('erpSacFnb')} /></Field>
              <Field label="SAC — Banquets"><Input value={settings.erpSacBanquet} onChange={set('erpSacBanquet')} /></Field>
              <Field label="SAC — Laundry"><Input value={settings.erpSacLaundry} onChange={set('erpSacLaundry')} /></Field>
            </div>
          </div>
        </Section>

        <Section title="Front Office & POS">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Check-in Time"><Input type="time" value={settings.erpCheckInTime} onChange={set('erpCheckInTime')} /></Field>
            <Field label="Check-out Time"><Input type="time" value={settings.erpCheckOutTime} onChange={set('erpCheckOutTime')} /></Field>
            <Field label="Business Date" hint="Advanced by night audit">
              <Input value={settings.erpBusinessDate} onChange={set('erpBusinessDate')} />
            </Field>
            <Field label="Restaurant Tables"><Input type="number" value={settings.erpPosTableCount} onChange={set('erpPosTableCount')} /></Field>
          </div>
        </Section>

        <Section title="Payroll Statutory">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="EPF Wage Base Cap (₹/month)"><Input type="number" value={settings.erpPfCapBase} onChange={set('erpPfCapBase')} /></Field>
            <Field label="ESI Wage Ceiling (₹/month)"><Input type="number" value={settings.erpEsiWageCeiling} onChange={set('erpEsiWageCeiling')} /></Field>
            <Field label="OT Multiplier (× hourly rate)"><Input type="number" value={settings.erpOtMultiplier} onChange={set('erpOtMultiplier')} /></Field>
            <Field label="Monthly Working Hours (for OT rate)"><Input type="number" value={settings.erpMonthlyWorkingHours} onChange={set('erpMonthlyWorkingHours')} /></Field>
            <Field label="Professional Tax Slabs (JSON — varies by state)" className="sm:col-span-2"
              hint='e.g. Odisha-style: [{"upTo":15000,"amount":0},{"upTo":25000,"amount":150},{"upTo":null,"amount":200}]'>
              <Input value={settings.erpPtSlabs} onChange={set('erpPtSlabs')} className="font-mono text-xs" />
            </Field>
          </div>
        </Section>
      </div>
    </div>
  );
}
