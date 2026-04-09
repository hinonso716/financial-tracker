import { describe, expect, it } from 'vitest'

import {
  getApplicableBudgetRule,
  getOverviewSummaryRows,
  getPeriodSummary,
  getTransactionsInPeriod,
} from './finance'
import type { BudgetRule, Category, Transaction } from './finance'

describe('finance helpers', () => {
  it('groups weekly periods starting on Monday', () => {
    const transactions: Transaction[] = [
      {
        id: 'txn-mon',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 80,
        occurredAt: '2026-04-06',
      },
      {
        id: 'txn-sun',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 40,
        occurredAt: '2026-04-12',
      },
      {
        id: 'txn-next-mon',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 25,
        occurredAt: '2026-04-13',
      },
    ]

    const weeklyTransactions = getTransactionsInPeriod({
      transactions,
      anchorDate: '2026-04-09',
      timeframe: 'weekly',
      weekStartsOn: 1,
    })

    expect(weeklyTransactions).toHaveLength(2)
    expect(weeklyTransactions.map((transaction) => transaction.id)).toEqual([
      'txn-mon',
      'txn-sun',
    ])
  })

  it('uses the latest mid-period budget change for the current period immediately', () => {
    const budgetRules: BudgetRule[] = [
      {
        id: 'budget-weekly-original',
        scope: 'total',
        timeframe: 'weekly',
        amount: 300,
        effectiveFrom: '2026-04-06T00:00:00.000Z',
      },
      {
        id: 'budget-weekly-updated',
        scope: 'total',
        timeframe: 'weekly',
        amount: 500,
        effectiveFrom: '2026-04-10T09:00:00.000Z',
      },
    ]

    const summary = getPeriodSummary({
      transactions: [
        {
          id: 'txn-current-week',
          type: 'expense',
          categoryId: 'expense-food',
          amount: 120,
          occurredAt: '2026-04-10',
        },
      ],
      budgetRules,
      anchorDate: '2026-04-10',
      timeframe: 'weekly',
      weekStartsOn: 1,
    })

    expect(summary.budget).toBe(500)
    expect(summary.remaining).toBe(380)
  })

  it('keeps the last budget active within a closed period when revisiting history', () => {
    const rules: BudgetRule[] = [
      {
        id: 'budget-april-start',
        scope: 'total',
        timeframe: 'monthly',
        amount: 5000,
        effectiveFrom: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'budget-april-update',
        scope: 'total',
        timeframe: 'monthly',
        amount: 6200,
        effectiveFrom: '2026-04-20T12:00:00.000Z',
      },
      {
        id: 'budget-may',
        scope: 'total',
        timeframe: 'monthly',
        amount: 7000,
        effectiveFrom: '2026-05-02T09:00:00.000Z',
      },
    ]

    const aprilRule = getApplicableBudgetRule({
      budgetRules: rules,
      scope: 'total',
      timeframe: 'monthly',
      effectiveAt: '2026-04-30T23:59:59.999Z',
    })
    const mayRule = getApplicableBudgetRule({
      budgetRules: rules,
      scope: 'total',
      timeframe: 'monthly',
      effectiveAt: '2026-05-31T23:59:59.999Z',
    })

    expect(aprilRule?.amount).toBe(6200)
    expect(mayRule?.amount).toBe(7000)
  })

  it('builds overview summary rows with remaining formulas and safe percent handling', () => {
    const categories: Category[] = [
      {
        id: 'expense-food',
        name: 'Food',
        kind: 'expense',
        archived: false,
      },
      {
        id: 'expense-travel',
        name: 'Travel',
        kind: 'expense',
        archived: false,
      },
    ]

    const budgetRules: BudgetRule[] = [
      {
        id: 'food-daily',
        scope: 'category',
        timeframe: 'daily',
        categoryId: 'expense-food',
        amount: 100,
        effectiveFrom: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'food-weekly',
        scope: 'category',
        timeframe: 'weekly',
        categoryId: 'expense-food',
        amount: 400,
        effectiveFrom: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'food-monthly',
        scope: 'category',
        timeframe: 'monthly',
        categoryId: 'expense-food',
        amount: 1000,
        effectiveFrom: '2026-04-01T00:00:00.000Z',
      },
    ]

    const transactions: Transaction[] = [
      {
        id: 'today-food',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 60,
        occurredAt: '2026-04-10',
      },
      {
        id: 'week-food',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 40,
        occurredAt: '2026-04-08',
      },
      {
        id: 'month-food',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 100,
        occurredAt: '2026-04-02',
      },
    ]

    const rows = getOverviewSummaryRows({
      categories,
      transactions,
      budgetRules,
      referenceDate: '2026-04-10',
      weekStartsOn: 1,
    })

    const foodRow = rows.find((row) => row.categoryId === 'expense-food')
    const travelRow = rows.find((row) => row.categoryId === 'expense-travel')

    expect(foodRow).toMatchObject({
      dailyBudget: 100,
      dailySpent: 60,
      dailyRemaining: 40,
      weeklyBudget: 400,
      weeklySpent: 100,
      weeklyRemaining: 300,
      monthlyBudget: 1000,
      monthlySpent: 200,
      monthlyRemaining: 800,
    })
    expect(foodRow?.monthlyPercentUsed).toBeCloseTo(20)
    expect(travelRow?.monthlyPercentUsed).toBe(0)
  })
})
