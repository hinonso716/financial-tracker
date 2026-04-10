import type { FormEvent } from 'react'

import {
  formatCurrency,
  formatDisplayDateTime,
} from '../lib/finance'
import type { BudgetScope, Category, Timeframe } from '../lib/finance'

type BudgetMatrixRow = {
  id: string
  label: string
  daily: {
    active: { amount: number; effectiveFrom: string } | null
  }
  weekly: {
    active: { amount: number; effectiveFrom: string } | null
  }
  monthly: {
    active: { amount: number; effectiveFrom: string } | null
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
  budgetAppliedAt: string
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
  budgetAppliedAt,
  budgetNotice,
  budgetMatrixRows,
  currency,
  onFormChange,
  onSubmit,
}: BudgetManagerProps) {
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
            <span className="info-label">Applies now</span>
            <strong>{formatDisplayDateTime(budgetAppliedAt)}</strong>
            <p>
              Saving a change updates the current {form.timeframe} budget
              immediately.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button-primary">
            Save budget change
          </button>
          {budgetNotice ? <p className="notice">{budgetNotice}</p> : null}
        </div>
      </form>

      <div className="budget-matrix-grid">
        {budgetMatrixRows.map((row) => (
          <article className="budget-matrix-card" key={row.id}>
            <div className="budget-matrix-card-header">
              <h3>{row.label}</h3>
            </div>

            <div className="budget-matrix-card-body">
              {(['daily', 'weekly', 'monthly'] as Timeframe[]).map((timeframe) => {
                const snapshot = row[timeframe]

                return (
                  <div className="budget-cell" key={timeframe}>
                    <strong>{timeframe[0].toUpperCase() + timeframe.slice(1)}</strong>
                    <span>
                      {snapshot.active
                        ? formatCurrency(snapshot.active.amount, currency)
                        : 'Not set'}
                    </span>
                    {snapshot.active ? (
                      <span className="muted-text">
                        Updated: {formatDisplayDateTime(snapshot.active.effectiveFrom)}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="table-shell compact desktop-table-shell">
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
                          Current:{' '}
                          {snapshot.active
                            ? formatCurrency(snapshot.active.amount, currency)
                            : 'Not set'}
                        </span>
                        {snapshot.active ? (
                          <span className="muted-text">
                            Updated:{' '}
                            {formatDisplayDateTime(snapshot.active.effectiveFrom)}
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
