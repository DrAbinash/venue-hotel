import { db } from '@/lib/db';

/**
 * ERP configuration. Rows live in the same HotelSetting table under the
 * "erp" group; every key is prefixed "erp" so the public settings endpoint
 * can keep them off the website payload.
 */
export const ERP_SETTING_DEFAULTS: Record<string, string> = {
  // Statutory identity — printed on tax invoices.
  erpLegalName: '',
  erpGstin: '',
  erpFssai: '',
  erpAddress: '',
  erpStateName: 'Odisha',
  erpStateCode: '21',
  erpPan: '',
  erpCin: '',
  erpInvoiceFooter: 'Thank you for staying with us. This is a computer generated invoice.',

  // GST — hospitality slabs, editable because the Council edits them too.
  erpRoomGstSlabs: '[{"upTo":7500,"rate":5},{"upTo":null,"rate":18}]',
  erpFnbGstRate: '5',
  erpBanquetGstRate: '5',
  erpLaundryGstRate: '18',
  erpMinibarGstRate: '18',
  erpMiscGstRate: '18',
  erpSacRoom: '996311',
  erpSacFnb: '996331',
  erpSacBanquet: '996334',
  erpSacLaundry: '999712',
  erpSacMisc: '999799',

  // Front office.
  erpCheckInTime: '14:00',
  erpCheckOutTime: '12:00',
  erpBusinessDate: '',

  // POS.
  erpPosTableCount: '12',

  // Payroll statutory knobs (monthly, INR).
  erpPfCapBase: '15000',
  erpEsiWageCeiling: '21000',
  erpPtSlabs: '[{"upTo":15000,"amount":0},{"upTo":25000,"amount":150},{"upTo":null,"amount":200}]',
  erpOtMultiplier: '2',
  erpMonthlyWorkingHours: '208',
};

export type ErpSettings = Record<string, string>;

export async function getErpSettings(): Promise<ErpSettings> {
  const rows = await db.hotelSetting.findMany({ where: { group: 'erp' } });
  const map: ErpSettings = { ...ERP_SETTING_DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getErpSetting(key: string): Promise<string> {
  const row = await db.hotelSetting.findUnique({ where: { key } });
  return row?.value ?? ERP_SETTING_DEFAULTS[key] ?? '';
}

export async function saveErpSettings(input: Record<string, unknown>): Promise<string[]> {
  const saved: string[] = [];
  for (const [key, raw] of Object.entries(input)) {
    if (!(key in ERP_SETTING_DEFAULTS)) continue;
    const value = raw === null || raw === undefined ? '' : String(raw);
    await db.hotelSetting.upsert({
      where: { key },
      update: { value, group: 'erp' },
      create: { key, value, group: 'erp' },
    });
    saved.push(key);
  }
  return saved;
}

export async function setErpSetting(key: string, value: string): Promise<void> {
  await db.hotelSetting.upsert({
    where: { key },
    update: { value, group: 'erp' },
    create: { key, value, group: 'erp' },
  });
}

export function erpNumber(settings: ErpSettings, key: string, fallback = 0): number {
  const parsed = Number.parseFloat(settings[key] ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}
