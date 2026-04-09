import type { AppState, BudgetRule, Category, Timeframe, Transaction } from './finance'

export const STORAGE_KEY = 'financial-tracker-state-v1'

export const DEFAULT_PREFERENCES = {
  currency: 'HKD',
  weekStartsOn: 1 as const,
}

const expenseNames = [
  'Dining',
  'Food',
  'Travel',
  'Transport',
  'Bills',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
]

const incomeNames = ['Salary', 'Freelance', 'Refund', 'Gift', 'Other']

const makeDefaultCategory = (
  name: string,
  kind: Category['kind'],
): Category => ({
  id: `${kind}-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  kind,
  archived: false,
})

export const createDefaultCategories = () => [
  ...expenseNames.map((name) => makeDefaultCategory(name, 'expense')),
  ...incomeNames.map((name) => makeDefaultCategory(name, 'income')),
]

export const createEmptyState = (): AppState => ({
  transactions: [],
  categories: createDefaultCategories(),
  budgetRules: [],
  preferences: {
    currency: 'HKD',
    weekStartsOn: 1,
  },
})

export const createTransactionId = () => `txn-${crypto.randomUUID()}`
export const createCategoryId = () => `category-${crypto.randomUUID()}`
export const createBudgetRuleId = () => `budget-${crypto.randomUUID()}`

export const isTransaction = (value: unknown): value is Transaction => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<Transaction>

  return (
    typeof candidate.id === 'string' &&
    (candidate.type === 'income' || candidate.type === 'expense') &&
    typeof candidate.categoryId === 'string' &&
    typeof candidate.amount === 'number' &&
    typeof candidate.occurredAt === 'string' &&
    (typeof candidate.note === 'string' || typeof candidate.note === 'undefined')
  )
}

export const isCategory = (value: unknown): value is Category => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<Category>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.kind === 'income' || candidate.kind === 'expense') &&
    typeof candidate.archived === 'boolean'
  )
}

export const isBudgetRule = (value: unknown): value is BudgetRule => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<BudgetRule>
  const validTimeframes: Timeframe[] = ['daily', 'weekly', 'monthly']

  return (
    typeof candidate.id === 'string' &&
    (candidate.scope === 'total' || candidate.scope === 'category') &&
    validTimeframes.includes(candidate.timeframe as Timeframe) &&
    typeof candidate.amount === 'number' &&
    typeof candidate.effectiveFrom === 'string' &&
    (typeof candidate.categoryId === 'string' || typeof candidate.categoryId === 'undefined')
  )
}
