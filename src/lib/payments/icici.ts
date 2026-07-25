import { createCipheriv, createDecipheriv } from 'crypto';

/**
 * ICICI Bank "Eazypay" hosted payment page.
 *
 * Eazypay takes a set of query parameters, each individually encrypted with
 * AES-128-ECB using the 16-character key issued by the bank, and redirects the
 * guest back to `Return URL` with the transaction outcome. Response code E000
 * means the payment succeeded.
 *
 * Reference: ICICI Eazypay merchant integration kit. Credentials are entered
 * in Admin → Payments (or via ICICI_* environment variables); nothing here is
 * hard-coded, so switching merchants never needs a code change.
 */

export interface IciciConfig {
  merchantId: string;
  subMerchantId: string;
  encryptionKey: string;
  endpoint: string;
  paymode: string;
  referencePrefix: string;
}

export const ICICI_SUCCESS_CODE = 'E000';

/** Eazypay expects exactly 16 bytes; short keys are padded, long ones trimmed. */
function normaliseKey(key: string): Buffer {
  const buf = Buffer.alloc(16, 0);
  Buffer.from(key, 'utf8').copy(buf, 0, 0, 16);
  return buf;
}

export function encryptField(value: string, key: string): string {
  const cipher = createCipheriv('aes-128-ecb', normaliseKey(key), null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]).toString('base64');
}

export function decryptField(value: string, key: string): string {
  const decipher = createDecipheriv('aes-128-ecb', normaliseKey(key), null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(Buffer.from(value, 'base64')), decipher.final()]).toString('utf8');
}

/** Eazypay rejects pipes and separators inside mandatory field values. */
function sanitise(value: string): string {
  return String(value ?? '').replace(/[|~^]/g, ' ').trim();
}

export interface IciciRequestInput {
  referenceNo: string;
  amount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  returnUrl: string;
}

/**
 * Build the redirect URL for the Eazypay hosted page.
 *
 * `mandatory fields` is a pipe-delimited tuple of
 * reference | sub-merchant | amount | <custom fields...>, encrypted as a whole.
 */
export function buildIciciRedirectUrl(config: IciciConfig, input: IciciRequestInput): string {
  if (!config.merchantId) throw new Error('ICICI merchant id is not configured.');
  if (!config.encryptionKey) throw new Error('ICICI encryption key is not configured.');

  const amount = input.amount.toFixed(2);
  const mandatory = [
    sanitise(input.referenceNo),
    sanitise(config.subMerchantId || config.merchantId),
    amount,
    sanitise(input.guestName),
    sanitise(input.guestEmail),
  ].join('|');

  const optional = [sanitise(input.guestPhone)].join('|');
  const key = config.encryptionKey;

  const params = new URLSearchParams();
  params.set('merchantid', config.merchantId);
  params.set('mandatory fields', encryptField(mandatory, key));
  params.set('optional fields', encryptField(optional, key));
  params.set('returnurl', encryptField(input.returnUrl, key));
  params.set('Reference No', encryptField(input.referenceNo, key));
  params.set('submerchantid', encryptField(config.subMerchantId || config.merchantId, key));
  params.set('transaction amount', encryptField(amount, key));
  params.set('paymode', encryptField(config.paymode || '9', key));

  const base = config.endpoint || 'https://eazypay.icicibank.com/EazyPG';
  return `${base}?${params.toString()}`;
}

export interface IciciResponse {
  responseCode: string;
  uniqueRefNumber: string;
  referenceNo: string;
  totalAmount: number;
  paymentMode: string;
  transactionDate: string;
  succeeded: boolean;
  raw: Record<string, string>;
}

/** Parse the parameters Eazypay appends to the return URL. */
export function parseIciciResponse(params: Record<string, string>): IciciResponse {
  const get = (...names: string[]): string => {
    for (const name of names) {
      const direct = params[name];
      if (direct !== undefined) return direct;
      const found = Object.keys(params).find((k) => k.toLowerCase() === name.toLowerCase());
      if (found) return params[found];
    }
    return '';
  };

  const responseCode = get('Response Code', 'ResponseCode', 'response_code').trim();
  const amountRaw = get('Total Amount', 'TotalAmount', 'transaction amount');

  return {
    responseCode,
    uniqueRefNumber: get('Unique Ref Number', 'UniqueRefNumber', 'unique_ref_number'),
    referenceNo: get('ReferenceNo', 'Reference No', 'mandatory fields').split('|')[0] ?? '',
    totalAmount: Number.parseFloat(amountRaw) || 0,
    paymentMode: get('Payment Mode', 'PaymentMode'),
    transactionDate: get('Transaction Date', 'TransactionDate'),
    succeeded: responseCode.toUpperCase() === ICICI_SUCCESS_CODE,
    raw: params,
  };
}

/**
 * Eazypay reference numbers must be unique per transaction and contain only
 * alphanumerics, so retries of the same booking get a fresh suffix.
 */
export function buildReferenceNo(prefix: string, bookingRef: string, attempt: number): string {
  const clean = `${prefix}${bookingRef}`.replace(/[^A-Za-z0-9]/g, '');
  return `${clean}${attempt}`.slice(0, 30);
}
