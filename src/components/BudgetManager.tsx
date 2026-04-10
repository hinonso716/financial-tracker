import type { FormEvent } from 'react'

import { formatCurrency, formatDisplayDateTime } from '../lib/finance'
import type { Category } from '../lib/finance'

type BudgetMatrixCell = {
  active: { amount: number; effectiveFrom: string } | null
  visibility: 'visible' | 'hidden'
}

type BudgetMatrixRow = {
  id: string
  label: string
  daily: BudgetMatrixCell
  weekly: BudgetMatrixCell
  monthly: BudgetMatrixCell
}

type BudgetManagerProps = {
  form: {
    categoryId: string
    amount: string
  }
  activeExpenseCategories: Category[]
  budgetAppliedAt: string
  budgetNotice: string
  budgetMatrixRows: BudgetMatrixRow[]
  currency: string
  showDailyBudget: boolean
  showWeeklyBudget: boolean
  onFormChange: (nextForm: {
    categoryId: string
    amount: string
  }) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleDailyBudget: (checked: boolean) => void
  onToggleWeeklyBudget: (checked: boolean) => void
}

const renderBudgetCell = (cell: BudgetMatrixCell, currency: string) => {
  if (cell.visibility === 'hidden') {
    return {
      label: 'Hidden',
      helper: 'Turn the toggle on to show this derived budget.',
    }
  }

  if (!cell.active) {
    return {
      label: 'Not set',
      helper: 'Add or update a monthly category budget first.',
    }
  }

  return {
    label: formatCurrency(cell.active.amount, currency),
    helper: `Updated: ${formatDisplayDateTime(cell.active.effectiveFrom)}`,
  }
}

function BudgetManager({
  form,
  activeExpenseCategories,
  budgetAppliedAt,
  budgetNotice,
  budgetMatrixRows,
  currency,
  showDailyBudget,
  showWeeklyBudget,
  onFormChange,
  onSubmit,
  onToggleDailyBudget,
  onToggleWeeklyBudget,
}: BudgetManagerProps) {
  return (
    <>
      <form className="form-grid" onSubmit={onSubmit}>
        <p className="page-description">
          Enter monthly budgets only. Overall budget is automatically added up from all
          expense categories.
        </p>

        <div className="field-row">
          <label className="field">
            <span>Expense category</span>
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

          <label className="field">
            <span>Monthly budget</span>
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
        </div>

        <div className="field-row">
          <label className="toggle-card">
            <div>
              <span>Show daily budget</span>
              <p>Derived from the current monthly budget.</p>
            </div>
            <input
              type="checkbox"
              checked={showDailyBudget}
              onChange={(event) => onToggleDailyBudget(event.target.checked)}
            />
          </label>

          <label className="toggle-card">
            <div>
              <span>Show weekly budget</span>
              <p>Derived from monthly budgets across the selected week.</p>
            </div>
            <input
              type="checkbox"
              checked={showWeeklyBudget}
              onChange={(event) => onToggleWeeklyBudget(event.target.checked)}
            />
          </label>
        </div>

        <div className="field-row">
          <div className="info-card">
            <span className="info-label">Applies now</span>
            <strong>{formatDisplayDateTime(budgetAppliedAt)}</strong>
            <p>Saving a change updates the active monthly budget immediately.</p>
          </div>

          <div className="form-actions inline-actions">
            <button type="submit" className="button button-primary">
              Save monthly budget
            </button>
            {budgetNotice ? <p className="notice">{budgetNotice}</p> : null}
          </div>
        </div>
      </form>

      <div className="budget-matrix-grid">
        {budgetMatrixRows.map((row) => (
          <article className="budget-matrix-card" key={row.id}>
            <div className="budget-matrix-card-header">
              <h3>{row.label}</h3>
            </div>

            <div className="budget-matrix-card-body">
              {(['monthly', 'daily', 'weekly'] as const).map((timeframe) => {
                const details = renderBudgetCell(row[timeframe], currency)

                return (
                  <div className="budget-cell" key={timeframe}>
                    <strong>{timeframe[0].toUpperCase() + timeframe.slice(1)}</strong>
                    <span>{details.label}</span>
                    <span className="muted-text">{details.helper}</span>
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
              <th>Category</th>
              <th>Monthly Input</th>
              <th>Daily Display</th>
              <th>Weekly Display</th>
            </tr>
          </thead>
          <tbody>
            {budgetMatrixRows.map((row) => (
              <tr key={row.id}>
                <th>{row.label}</th>
                {(['monthly', 'daily', 'weekly'] as const).map((timeframe) => {
                  const details = renderBudgetCell(row[timeframe], currency)

                  return (
                    <td key={timeframe}>
                      <div className="budget-cell">
                        <span>{details.label}</span>
                        <span className="muted-text">{details.helper}</span>
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
