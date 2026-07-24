import { getSettings, settingBool, settingNumber, type SettingsMap } from '@/lib/settings';
import type { IciciConfig } from '@/lib/payments/icici';
import type { RazorpayCredentials } from '@/lib/payments/razorpay';

export type GatewayId = 'razorpay' | 'icici' | 'payAtHotel' | 'bankTransfer';

export interface PaymentMethodOption {
  id: GatewayId;
  label: string;
  description: string;
  /** Online gateways redirect or open a widget; offline ones just record intent. */
  online: boolean;
}

export interface PaymentConfig {
  enabled: boolean;
  mode: 'test' | 'live';
  currency: string;
  currencySymbol: string;
  currencyLocale: string;
  allowPartialPayment: boolean;
  advancePercent: number;
  methods: PaymentMethodOption[];
  razorpayKeyId: string;
  razorpayThemeColor: string;
  bank: {
    name: string;
    accountName: string;
    accountNumber: string;
    ifsc: string;
    upiId: string;
  };
  payAtHotelNote: string;
}

/** Which gateways are fully configured and switched on right now. */
export function resolvePaymentConfig(settings: SettingsMap): PaymentConfig {
  const enabled = settingBool(settings, 'paymentsEnabled');
  const methods: PaymentMethodOption[] = [];

  const razorpayReady =
    settingBool(settings, 'razorpayEnabled') &&
    Boolean(settings.razorpayKeyId) &&
    Boolean(settings.razorpayKeySecret);
  if (enabled && razorpayReady) {
    methods.push({
      id: 'razorpay',
      label: 'Razorpay',
      description: settings.razorpayLabel || 'Cards, UPI, Net Banking & Wallets',
      online: true,
    });
  }

  const iciciReady =
    settingBool(settings, 'iciciEnabled') &&
    Boolean(settings.iciciMerchantId) &&
    Boolean(settings.iciciEncryptionKey);
  if (enabled && iciciReady) {
    methods.push({
      id: 'icici',
      label: 'ICICI Bank',
      description: settings.iciciLabel || 'ICICI Bank Payment Gateway',
      online: true,
    });
  }

  if (settingBool(settings, 'bankTransferEnabled')) {
    methods.push({
      id: 'bankTransfer',
      label: settings.bankTransferLabel || 'Direct Bank Transfer / UPI',
      description: 'Transfer the amount and share the reference with us.',
      online: false,
    });
  }

  if (settingBool(settings, 'payAtHotelEnabled')) {
    methods.push({
      id: 'payAtHotel',
      label: settings.payAtHotelLabel || 'Pay at the Hotel',
      description: settings.payAtHotelNote || 'Settle the amount at check-in.',
      online: false,
    });
  }

  return {
    enabled,
    mode: settings.paymentMode === 'live' ? 'live' : 'test',
    currency: settings.currency || 'INR',
    currencySymbol: settings.currencySymbol || '₹',
    currencyLocale: settings.currencyLocale || 'en-IN',
    allowPartialPayment: settingBool(settings, 'allowPartialPayment'),
    advancePercent: settingNumber(settings, 'advancePercent', 25),
    methods,
    razorpayKeyId: settings.razorpayKeyId || '',
    razorpayThemeColor: settings.razorpayThemeColor || '#c9a96e',
    bank: {
      name: settings.bankName || '',
      accountName: settings.bankAccountName || '',
      accountNumber: settings.bankAccountNumber || '',
      ifsc: settings.bankIfsc || '',
      upiId: settings.bankUpiId || '',
    },
    payAtHotelNote: settings.payAtHotelNote || '',
  };
}

export async function loadPaymentConfig(): Promise<{ settings: SettingsMap; config: PaymentConfig }> {
  const settings = await getSettings();
  return { settings, config: resolvePaymentConfig(settings) };
}

export function razorpayCredentials(settings: SettingsMap): RazorpayCredentials {
  return { keyId: settings.razorpayKeyId || '', keySecret: settings.razorpayKeySecret || '' };
}

export function iciciConfig(settings: SettingsMap): IciciConfig {
  return {
    merchantId: settings.iciciMerchantId || '',
    subMerchantId: settings.iciciSubMerchantId || '',
    encryptionKey: settings.iciciEncryptionKey || '',
    endpoint: settings.iciciEndpoint || 'https://eazypay.icicibank.com/EazyPG',
    paymode: settings.iciciPaymode || '9',
    referencePrefix: settings.iciciRefPrefix || 'TV',
  };
}

/** Base URL used to build gateway return/callback links. */
export function siteOrigin(request: Request): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) return `${forwardedProto || 'http'}://${forwardedHost}`;
  return new URL(request.url).origin;
}
