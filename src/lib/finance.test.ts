import { describe, expect, it } from 'vitest'

import {
  formatStorageDate,
  getApplicableBudgetRule,
  getPeriodSummary,
  getTransactionsInPeriod,
} from './finance'
import type { BudgetRule, Transaction } from './finance'

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

  it('returns signed remaining values for under, exact, and over-budget periods', () => {
    const budgetRules: BudgetRule[] = [
      {
        id: 'budget-weekly',
        scope: 'total',
        timeframe: 'weekly',
        amount: 300,
        effectiveFrom: '2026-04-06',
      },
    ]

    const underBudgetSummary = getPeriodSummary({
      transactions: [
        {
          id: 'txn-under',
          type: 'expense',
          categoryId: 'expense-food',
          amount: 120,
          occurredAt: '2026-04-07',
        },
      ],
      budgetRules,
      anchorDate: '2026-04-10',
      timeframe: 'weekly',
      weekStartsOn: 1,
    })

    const exactBudgetSummary = getPeriodSummary({
      transactions: [
        {
          id: 'txn-exact',
          type: 'expense',
          categoryId: 'expense-food',
          amount: 300,
          occurredAt: '2026-04-07',
        },
      ],
      budgetRules,
      anchorDate: '2026-04-10',
      timeframe: 'weekly',
      weekStartsOn: 1,
    })

    const overBudgetSummary = getPeriodSummary({
      transactions: [
        {
          id: 'txn-over',
          type: 'expense',
          categoryId: 'expense-food',
          amount: 360,
          occurredAt: '2026-04-07',
        },
      ],
      budgetRules,
      anchorDate: '2026-04-10',
      timeframe: 'weekly',
      weekStartsOn: 1,
    })

    expect(underBudgetSummary.remaining).toBe(180)
    expect(exactBudgetSummary.remaining).toBe(0)
    expect(overBudgetSummary.remaining).toBe(-60)
  })

  it('keeps historical budgets stable when newer rules are added later', () => {
    const rules: BudgetRule[] = [
      {
        id: 'budget-april',
        scope: 'total',
        timeframe: 'monthly',
        amount: 5000,
        effectiveFrom: '2026-04-01',
      },
      {
        id: 'budget-may',
        scope: 'total',
        timeframe: 'monthly',
        amount: 6200,
        effectiveFrom: '2026-05-01',
      },
    ]

    const aprilRule = getApplicableBudgetRule({
      budgetRules: rules,
      scope: 'total',
      timeframe: 'monthly',
      periodStart: formatStorageDate(new Date('2026-04-01')),
    })
    const mayRule = getApplicableBudgetRule({
      budgetRules: rules,
      scope: 'total',
      timeframe: 'monthly',
      periodStart: formatStorageDate(new Date('2026-05-01')),
    })

    expect(aprilRule?.amount).toBe(5000)
    expect(mayRule?.amount).toBe(6200)
  })
})
