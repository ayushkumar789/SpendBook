export interface Bank {
  key: string;
  name: string;
  initials: string;
  color: string;
}

export const BANKS: Bank[] = [
  { key: 'sbi', name: 'SBI', initials: 'SBI', color: '#1a56db' },
  { key: 'hdfc', name: 'HDFC Bank', initials: 'HDFC', color: '#004c97' },
  { key: 'icici', name: 'ICICI Bank', initials: 'ICICI', color: '#f96900' },
  { key: 'axis', name: 'Axis Bank', initials: 'AXIS', color: '#97144d' },
  { key: 'kotak', name: 'Kotak Mahindra', initials: 'KMB', color: '#ed1c24' },
  { key: 'pnb', name: 'PNB', initials: 'PNB', color: '#d4a017' },
  { key: 'boi', name: 'Bank of India', initials: 'BOI', color: '#1a56db' },
  { key: 'canara', name: 'Canara Bank', initials: 'CAN', color: '#0e7490' },
  { key: 'yes', name: 'Yes Bank', initials: 'YES', color: '#2563eb' },
  { key: 'indusind', name: 'IndusInd Bank', initials: 'IND', color: '#7c3aed' },
  { key: 'idfc', name: 'IDFC First Bank', initials: 'IDFC', color: '#16a34a' },
  { key: 'federal', name: 'Federal Bank', initials: 'FED', color: '#b91c1c' },
  { key: 'bob', name: 'Bank of Baroda', initials: 'BOB', color: '#f59e0b' },
  { key: 'union', name: 'Union Bank', initials: 'UBI', color: '#0284c7' },
  { key: 'other', name: 'Other Bank', initials: 'OTH', color: '#64748b' },
];

export function getBankByKey(key: string): Bank | undefined {
  return BANKS.find((b) => b.key === key);
}
