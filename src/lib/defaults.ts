import type {
  AppState,
  BudgetRule,
  Category,
  Preferences,
  Timeframe,
  Transaction,
} from './finance'

export const DEFAULT_PREFERENCES = {
  currency: 'HKD',
  weekStartsOn: 1,
  showDailyBudget: true,
  showWeeklyBudget: true,
} satisfies Preferences

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
  sortOrder: number,
): Category => ({
  id: `${kind}-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  kind,
  archived: false,
  sortOrder,
})

export const createDefaultCategories = () => [
  ...expenseNames.map((name, index) => makeDefaultCategory(name, 'expense', index)),
  ...incomeNames.map((name, index) => makeDefaultCategory(name, 'income', index)),
]

export const createEmptyState = (): AppState => ({
  transactions: [],
  categories: createDefaultCategories(),
  budgetRules: [],
  preferences: { ...DEFAULT_PREFERENCES },
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
    (typeof candidate.note === 'string' || typeof candidate.note === 'undefined') &&
    (typeof candidate.description === 'string' ||
      typeof candidate.description === 'undefined') &&
    (typeof candidate.remarks === 'string' || typeof candidate.remarks === 'undefined')
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
    typeof candidate.archived === 'boolean' &&
    (typeof candidate.sortOrder === 'number' || typeof candidate.sortOrder === 'undefined')
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
