import { describe, expect, it } from 'vitest'

import { DEFAULT_PREFERENCES } from './defaults'
import {
  getApplicableBudgetRule,
  getMonthlyReport,
  getOverviewSummaryRows,
  getPeriodSummary,
  getTransactionsInPeriod,
} from './finance'
import type { BudgetRule, Category, Transaction } from './finance'

const categories: Category[] = [
  {
    id: 'expense-food',
    name: 'Food',
    kind: 'expense',
    archived: false,
    sortOrder: 0,
  },
  {
    id: 'expense-travel',
    name: 'Travel',
    kind: 'expense',
    archived: false,
    sortOrder: 1,
  },
  {
    id: 'income-salary',
    name: 'Salary',
    kind: 'income',
    archived: false,
    sortOrder: 0,
  },
]

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

  it('updates current weekly budget immediately when monthly budget changes mid-week', () => {
    const budgetRules: BudgetRule[] = [
      {
        id: 'food-april-start',
        scope: 'category',
        timeframe: 'monthly',
        categoryId: 'expense-food',
        amount: 3000,
        effectiveFrom: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'food-april-update',
        scope: 'category',
        timeframe: 'monthly',
        categoryId: 'expense-food',
        amount: 3600,
        effectiveFrom: '2026-04-10T09:00:00.000Z',
      },
    ]

    const summary = getPeriodSummary({
      categories,
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
      preferences: DEFAULT_PREFERENCES,
    })

    expect(summary.budget).toBe(760)
    expect(summary.remaining).toBe(640)
  })

  it('keeps the last monthly category budget active within a closed period when revisiting history', () => {
    const rules: BudgetRule[] = [
      {
        id: 'food-april-start',
        scope: 'category',
        timeframe: 'monthly',
        categoryId: 'expense-food',
        amount: 5000,
        effectiveFrom: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'food-april-update',
        scope: 'category',
        timeframe: 'monthly',
        categoryId: 'expense-food',
        amount: 6200,
        effectiveFrom: '2026-04-20T12:00:00.000Z',
      },
      {
        id: 'food-may',
        scope: 'category',
        timeframe: 'monthly',
        categoryId: 'expense-food',
        amount: 7000,
        effectiveFrom: '2026-05-02T09:00:00.000Z',
      },
    ]

    const aprilRule = getApplicableBudgetRule({
      budgetRules: rules,
      scope: 'category',
      timeframe: 'monthly',
      categoryId: 'expense-food',
      effectiveAt: '2026-04-30T23:59:59.999Z',
    })
    const mayRule = getApplicableBudgetRule({
      budgetRules: rules,
      scope: 'category',
      timeframe: 'monthly',
      categoryId: 'expense-food',
      effectiveAt: '2026-05-31T23:59:59.999Z',
    })

    expect(aprilRule?.amount).toBe(6200)
    expect(mayRule?.amount).toBe(7000)
  })

  it('builds overview rows from monthly budgets and keeps percent calculations safe', () => {
    const budgetRules: BudgetRule[] = [
      {
        id: 'food-monthly',
        scope: 'category',
        timeframe: 'monthly',
        categoryId: 'expense-food',
        amount: 3000,
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
      preferences: DEFAULT_PREFERENCES,
    })

    const foodRow = rows.find((row) => row.categoryId === 'expense-food')
    const travelRow = rows.find((row) => row.categoryId === 'expense-travel')

    expect(foodRow).toMatchObject({
      dailyBudget: 100,
      dailySpent: 60,
      dailyRemaining: 40,
      weeklyBudget: 700,
      weeklySpent: 100,
      weeklyRemaining: 600,
      monthlyBudget: 3000,
      monthlySpent: 200,
      monthlyRemaining: 2800,
    })
    expect(foodRow?.monthlyPercentUsed).toBeCloseTo(200 / 3000 * 100)
    expect(travelRow?.monthlyPercentUsed).toBe(0)
  })

  it('builds a monthly report with grouped totals and previous-month comparison', () => {
    const transactions: Transaction[] = [
      {
        id: 'salary-apr',
        type: 'income',
        categoryId: 'income-salary',
        amount: 10000,
        occurredAt: '2026-04-05',
      },
      {
        id: 'food-apr',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 1200,
        occurredAt: '2026-04-08',
      },
      {
        id: 'travel-apr',
        type: 'expense',
        categoryId: 'expense-travel',
        amount: 800,
        occurredAt: '2026-04-18',
      },
      {
        id: 'salary-mar',
        type: 'income',
        categoryId: 'income-salary',
        amount: 9000,
        occurredAt: '2026-03-05',
      },
      {
        id: 'food-mar',
        type: 'expense',
        categoryId: 'expense-food',
        amount: 3000,
        occurredAt: '2026-03-18',
      },
    ]

    const report = getMonthlyReport({
      categories,
      transactions,
      anchorDate: '2026-04-10',
    })

    expect(report.monthLabel).toBe('April 2026')
    expect(report.incomeTotal).toBe(10000)
    expect(report.expenseTotal).toBe(2000)
    expect(report.balance).toBe(8000)
    expect(report.incomeRows[0]).toMatchObject({
      categoryId: 'income-salary',
      amount: 10000,
    })
    expect(report.expenseRows.map((row) => row.categoryId)).toEqual([
      'expense-food',
      'expense-travel',
    ])
    expect(report.balanceChangePct).toBeCloseTo(((8000 - 6000) / 6000) * 100)
  })
})
