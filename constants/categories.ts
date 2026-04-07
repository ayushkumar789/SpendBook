export interface Category {
  key: string;
  label: string;
  emoji: string;
  type: 'in' | 'out' | 'both';
}

export const CATEGORIES: Category[] = [
  { key: 'food', label: 'Food & Dining', emoji: '🍽️', type: 'out' },
  { key: 'transport', label: 'Transport', emoji: '🚗', type: 'out' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️', type: 'out' },
  { key: 'entertainment', label: 'Entertainment', emoji: '🎬', type: 'out' },
  { key: 'health', label: 'Health & Medical', emoji: '🏥', type: 'out' },
  { key: 'education', label: 'Education', emoji: '📚', type: 'out' },
  { key: 'salary', label: 'Salary / Income', emoji: '💼', type: 'in' },
  { key: 'gift', label: 'Gift', emoji: '🎁', type: 'both' },
  { key: 'investment', label: 'Investment', emoji: '📈', type: 'both' },
  { key: 'bills', label: 'Bills & Utilities', emoji: '🧾', type: 'out' },
  { key: 'rent', label: 'Rent', emoji: '🏠', type: 'out' },
  { key: 'travel', label: 'Travel', emoji: '✈️', type: 'out' },
  { key: 'other', label: 'Other', emoji: '💰', type: 'both' },
];

export function getCategoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function getCategoriesForType(type: 'in' | 'out'): Category[] {
  return CATEGORIES.filter((c) => c.type === type || c.type === 'both');
}
