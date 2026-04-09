import { createDefaultCategories, createEmptyState, isBudgetRule, isCategory, isTransaction, STORAGE_KEY } from './defaults'
import type { AppState } from './finance'

const normalizeAppState = (value: unknown): AppState => {
  const fallback = createEmptyState()

  if (!value || typeof value !== 'object') {
    return fallback
  }

  const candidate = value as Partial<AppState>
  const categories = Array.isArray(candidate.categories)
    ? candidate.categories.filter(isCategory)
    : []

  return {
    transactions: Array.isArray(candidate.transactions)
      ? candidate.transactions.filter(isTransaction)
      : [],
    categories: categories.length > 0 ? categories : createDefaultCategories(),
    budgetRules: Array.isArray(candidate.budgetRules)
      ? candidate.budgetRules.filter(isBudgetRule)
      : [],
    preferences: {
      currency: candidate.preferences?.currency === 'HKD' ? 'HKD' : 'HKD',
      weekStartsOn: candidate.preferences?.weekStartsOn === 1 ? 1 : 1,
    },
  }
}

export const loadAppState = (): AppState => {
  if (typeof window === 'undefined') {
    return createEmptyState()
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY)

    if (!storedValue) {
      return createEmptyState()
    }

    return normalizeAppState(JSON.parse(storedValue))
  } catch {
    return createEmptyState()
  }
}

export const saveAppState = (state: AppState) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
