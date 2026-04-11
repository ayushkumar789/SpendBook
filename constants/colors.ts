export interface AppColors {
  primary: string;
  secondary: string;
  pageBg: string;
  cashIn: string;
  cashInBg: string;
  cashInDark: string;
  cashOut: string;
  cashOutBg: string;
  cashOutDark: string;
  balance: string;
  balanceBg: string;
  balanceDark: string;
  card: string;
  border: string;
  muted: string;
  body: string;
  white: string;
  black: string;
  bookColors: string[];
  chartColors: string[];
}

export const LightColors: AppColors = {
  primary: '#5c2d91',
  secondary: '#7c3aed',
  pageBg: '#f8f5ff',
  cashIn: '#22c55e',
  cashInBg: '#f0fdf4',
  cashInDark: '#15803d',
  cashOut: '#ef4444',
  cashOutBg: '#fef2f2',
  cashOutDark: '#b91c1c',
  balance: '#3b82f6',
  balanceBg: '#eff6ff',
  balanceDark: '#1d4ed8',
  card: '#ffffff',
  border: '#e2e8f0',
  muted: '#94a3b8',
  body: '#1e293b',
  white: '#ffffff',
  black: '#000000',
  bookColors: ['#5c2d91','#7c3aed','#2563eb','#0891b2','#16a34a','#d97706','#dc2626','#db2777'],
  chartColors: ['#5c2d91','#7c3aed','#2563eb','#0891b2','#16a34a','#d97706','#dc2626','#db2777','#0d9488','#65a30d','#ea580c','#7c3aed','#0284c7'],
};

export const DarkColors: AppColors = {
  primary: '#5c2d91',
  secondary: '#7c3aed',
  pageBg: '#121212',
  cashIn: '#22c55e',
  cashInBg: '#052e16',
  cashInDark: '#4ade80',
  cashOut: '#ef4444',
  cashOutBg: '#450a0a',
  cashOutDark: '#f87171',
  balance: '#3b82f6',
  balanceBg: '#172554',
  balanceDark: '#60a5fa',
  card: '#1e1e1e',
  border: '#2d2d2d',
  muted: '#94a3b8',
  body: '#f1f5f9',
  white: '#ffffff',
  black: '#000000',
  bookColors: ['#5c2d91','#7c3aed','#2563eb','#0891b2','#16a34a','#d97706','#dc2626','#db2777'],
  chartColors: ['#5c2d91','#7c3aed','#2563eb','#0891b2','#16a34a','#d97706','#dc2626','#db2777','#0d9488','#65a30d','#ea580c','#7c3aed','#0284c7'],
};

// Backward-compat alias — used by non-themed components and StyleSheet.create at module level
export const Colors = LightColors;
