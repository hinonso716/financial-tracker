import type { FormEvent } from 'react'

import { formatCurrency, formatDisplayDate } from '../lib/finance'
import type { BudgetScope, Category, Timeframe } from '../lib/finance'

type BudgetMatrixRow = {
  id: string
  label: string
  daily: {
    active: { amount: number } | null
    next: { amount: number; effectiveFrom: string } | null
  }
  weekly: {
    active: { amount: number } | null
    next: { amount: number; effectiveFrom: string } | null
  }
  monthly: {
    active: { amount: number } | null
    next: { amount: number; effectiveFrom: string } | null
  }
}

type BudgetManagerProps = {
  form: {
    scope: BudgetScope
    categoryId: string
    timeframe: Timeframe
    amount: string
  }
  activeExpenseCategories: Category[]
  budgetEffectiveFrom: string
  budgetNotice: string
  budgetMatrixRows: BudgetMatrixRow[]
  currency: string
  onFormChange: (nextForm: {
    scope: BudgetScope
    categoryId: string
    timeframe: Timeframe
    amount: string
  }) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function BudgetManager({
  form,
  activeExpenseCategories,
  budgetEffectiveFrom,
  budgetNotice,
  budgetMatrixRows,
  currency,
  onFormChange,
  onSubmit,
}: BudgetManagerProps) {
  const timeframeNames: Record<Timeframe, string> = {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
  }

  return (
    <>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="field-row">
          <label className="field">
            <span>Budget target</span>
            <select
              value={form.scope}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  scope: event.target.value as BudgetScope,
                })
              }
            >
              <option value="total">Overall budget</option>
              <option value="category">Specific category</option>
            </select>
          </label>

          <label className="field">
            <span>Timeframe</span>
            <select
              value={form.timeframe}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  timeframe: event.target.value as Timeframe,
                })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>

        {form.scope === 'category' ? (
          <label className="field">
            <span>Category</span>
            <select
              value={form.categoryId}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  categoryId: event.target.value,
                })
              }
            >
              {activeExpenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span>Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  amount: event.target.value,
                })
              }
            />
          </label>

          <div className="info-card">
            <span className="info-label">Takes effect</span>
            <strong>{formatDisplayDate(budgetEffectiveFrom)}</strong>
            <p>
              This avoids changing the budget mid-{timeframeNames[form.timeframe]}.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button-primary">
            Schedule budget
          </button>
          {budgetNotice ? <p className="notice">{budgetNotice}</p> : null}
        </div>
      </form>

      <div className="table-shell compact">
        <table className="data-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Daily</th>
              <th>Weekly</th>
              <th>Monthly</th>
            </tr>
          </thead>
          <tbody>
            {budgetMatrixRows.map((row) => (
              <tr key={row.id}>
                <th>{row.label}</th>
                {(['daily', 'weekly', 'monthly'] as Timeframe[]).map((timeframe) => {
                  const snapshot = row[timeframe]

                  return (
                    <td key={timeframe}>
                      <div className="budget-cell">
                        <span>
                          Active:{' '}
                          {snapshot.active
                            ? formatCurrency(snapshot.active.amount, currency)
                            : 'Not set'}
                        </span>
                        {snapshot.next ? (
                          <span className="muted-text">
                            Next: {formatCurrency(snapshot.next.amount, currency)} from{' '}
                            {formatDisplayDate(snapshot.next.effectiveFrom)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default BudgetManager
