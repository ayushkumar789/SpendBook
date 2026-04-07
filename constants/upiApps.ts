export interface UpiApp {
  key: string;
  name: string;
  initials: string;
  color: string;
}

export const UPI_APPS: UpiApp[] = [
  { key: 'gpay', name: 'Google Pay', initials: 'GPay', color: '#1a73e8' },
  { key: 'phonepe', name: 'PhonePe', initials: 'PPe', color: '#5f259f' },
  { key: 'paytm', name: 'Paytm', initials: 'PTM', color: '#00b9f1' },
  { key: 'bhim', name: 'BHIM', initials: 'BHIM', color: '#1e3a5f' },
  { key: 'amazon', name: 'Amazon Pay', initials: 'APay', color: '#ff9900' },
  { key: 'cred', name: 'CRED', initials: 'CRED', color: '#1a1a2e' },
  { key: 'imobile', name: 'iMobile Pay', initials: 'iMob', color: '#f96900' },
  { key: 'yonosbi', name: 'Yono SBI', initials: 'YONO', color: '#1a56db' },
  { key: 'supermoney', name: 'SuperMoney', initials: 'SMny', color: '#7c3aed' },
  { key: 'mobikwik', name: 'MobiKwik', initials: 'MKwk', color: '#2563eb' },
  { key: 'airtel', name: 'Airtel Money', initials: 'Airt', color: '#dc2626' },
  { key: 'other', name: 'Other UPI', initials: 'UPI', color: '#64748b' },
];

export function getUpiAppByKey(key: string): UpiApp | undefined {
  return UPI_APPS.find((a) => a.key === key);
}
