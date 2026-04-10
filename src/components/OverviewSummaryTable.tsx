import { formatCurrency, formatSignedCurrency } from '../lib/finance'
import type { OverviewSummaryRow } from '../lib/finance'

type OverviewSummaryTableProps = {
  rows: OverviewSummaryRow[]
  overallRow: OverviewSummaryRow
  currency: string
  showDailyBudget: boolean
  showWeeklyBudget: boolean
}

const renderBudgetValue = (
  hasBudget: boolean,
  value: number,
  currency: string,
  visibility: 'visible' | 'hidden',
) => {
  if (visibility === 'hidden') {
    return 'Hidden'
  }

  return hasBudget ? formatCurrency(value, currency) : 'No budget'
}

const renderRemainingValue = (
  hasBudget: boolean,
  value: number | null,
  currency: string,
  visibility: 'visible' | 'hidden',
) => {
  if (visibility === 'hidden') {
    return 'Hidden'
  }

  if (!hasBudget || value === null) {
    return 'No budget'
  }

  return formatSignedCurrency(value, currency)
}

const getRemainingTone = (value: number | null) => {
  if (value === null || value === 0) {
    return 'neutral'
  }

  return value > 0 ? 'positive' : 'negative'
}

const formatPercent = (value: number) => (value === 0 ? '0%' : `${value.toFixed(2)}%`)

const summaryColumns = [
  {
    label: 'Daily',
    budgetLabel: 'Daily Budget (A)',
    spentLabel: 'Spent Today (B)',
    remainingLabel: 'Daily Remaining (C = A - B)',
    getBudget: (row: OverviewSummaryRow) => row.dailyBudget,
    getSpent: (row: OverviewSummaryRow) => row.dailySpent,
    getRemaining: (row: OverviewSummaryRow) => row.dailyRemaining,
    hasBudget: (row: OverviewSummaryRow) => row.dailyHasBudget,
    visibility: (...visibilityArgs: [boolean, boolean]): 'visible' | 'hidden' =>
      visibilityArgs[0] ? 'visible' : 'hidden',
  },
  {
    label: 'Weekly',
    budgetLabel: 'Weekly Budget (D)',
    spentLabel: 'Spent This Week (E)',
    remainingLabel: 'Weekly Remaining (F = D - E)',
    getBudget: (row: OverviewSummaryRow) => row.weeklyBudget,
    getSpent: (row: OverviewSummaryRow) => row.weeklySpent,
    getRemaining: (row: OverviewSummaryRow) => row.weeklyRemaining,
    hasBudget: (row: OverviewSummaryRow) => row.weeklyHasBudget,
    visibility: (...visibilityArgs: [boolean, boolean]): 'visible' | 'hidden' =>
      visibilityArgs[1] ? 'visible' : 'hidden',
  },
  {
    label: 'Monthly',
    budgetLabel: 'Monthly Budget (G)',
    spentLabel: 'Spent This Month (H)',
    remainingLabel: 'Monthly Remaining (I = G - H)',
    getBudget: (row: OverviewSummaryRow) => row.monthlyBudget,
    getSpent: (row: OverviewSummaryRow) => row.monthlySpent,
    getRemaining: (row: OverviewSummaryRow) => row.monthlyRemaining,
    hasBudget: (row: OverviewSummaryRow) => row.monthlyHasBudget,
    visibility: (): 'visible' | 'hidden' => 'visible',
  },
] as const

function OverviewSummaryTable({
  rows,
  overallRow,
  currency,
  showDailyBudget,
  showWeeklyBudget,
}: OverviewSummaryTableProps) {
  const displayRows = [...rows, overallRow]

  return (
    <>
      <div className="overview-card-list" data-testid="overview-summary-cards">
        {displayRows.map((row) => (
          <article
            key={row.categoryId}
            className={`overview-card ${row.categoryId === 'overall' ? 'overall-row' : ''}`}
          >
            <div className="overview-card-header">
              <div>
                <p className="eyebrow">Category</p>
                <h3>{row.categoryName}</h3>
              </div>
              <div className="overview-percent-chip">
                <span>% Used (J)</span>
                <strong>{formatPercent(row.monthlyPercentUsed)}</strong>
              </div>
            </div>

            <div className="overview-period-grid">
              {summaryColumns.map((column) => {
                const remaining = column.getRemaining(row)
                const hasBudget = column.hasBudget(row)
                const visibility = column.visibility(showDailyBudget, showWeeklyBudget)

                return (
                  <section className="overview-period-card" key={column.label}>
                    <h4>{column.label}</h4>
                    <dl className="overview-metric-list">
                      <div className="overview-metric">
                        <dt>{column.budgetLabel}</dt>
                        <dd>
                          {renderBudgetValue(
                            hasBudget,
                            column.getBudget(row),
                            currency,
                            visibility,
                          )}
                        </dd>
                      </div>
                      <div className="overview-metric">
                        <dt>{column.spentLabel}</dt>
                        <dd>{formatCurrency(column.getSpent(row), currency)}</dd>
                      </div>
                      <div className="overview-metric">
                        <dt>{column.remainingLabel}</dt>
                        <dd className={getRemainingTone(remaining)}>
                          {renderRemainingValue(
                            hasBudget,
                            remaining,
                            currency,
                            visibility,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>
                )
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="table-shell overview-desktop-table">
        <table className="data-table overview-table" data-testid="overview-summary-table">
          <thead>
            <tr>
              <th>Main Category</th>
              <th>Daily Budget (A)</th>
              <th>Spent Today (B)</th>
              <th>Daily Remaining (C = A - B)</th>
              <th>Weekly Budget (D)</th>
              <th>Spent This Week (E)</th>
              <th>Weekly Remaining (F = D - E)</th>
              <th>Monthly Budget (G)</th>
              <th>Spent This Month (H)</th>
              <th>Monthly Remaining (I = G - H)</th>
              <th>% Used (J)</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.categoryId}
                className={row.categoryId === 'overall' ? 'overall-row' : ''}
              >
                <th>{row.categoryName}</th>
                <td>
                  {renderBudgetValue(
                    row.dailyHasBudget,
                    row.dailyBudget,
                    currency,
                    showDailyBudget ? 'visible' : 'hidden',
                  )}
                </td>
                <td>{formatCurrency(row.dailySpent, currency)}</td>
                <td className={getRemainingTone(row.dailyRemaining)}>
                  {renderRemainingValue(
                    row.dailyHasBudget,
                    row.dailyRemaining,
                    currency,
                    showDailyBudget ? 'visible' : 'hidden',
                  )}
                </td>
                <td>
                  {renderBudgetValue(
                    row.weeklyHasBudget,
                    row.weeklyBudget,
                    currency,
                    showWeeklyBudget ? 'visible' : 'hidden',
                  )}
                </td>
                <td>{formatCurrency(row.weeklySpent, currency)}</td>
                <td className={getRemainingTone(row.weeklyRemaining)}>
                  {renderRemainingValue(
                    row.weeklyHasBudget,
                    row.weeklyRemaining,
                    currency,
                    showWeeklyBudget ? 'visible' : 'hidden',
                  )}
                </td>
                <td>
                  {renderBudgetValue(
                    row.monthlyHasBudget,
                    row.monthlyBudget,
                    currency,
                    'visible',
                  )}
                </td>
                <td>{formatCurrency(row.monthlySpent, currency)}</td>
                <td className={getRemainingTone(row.monthlyRemaining)}>
                  {renderRemainingValue(
                    row.monthlyHasBudget,
                    row.monthlyRemaining,
                    currency,
                    'visible',
                  )}
                </td>
                <td>{formatPercent(row.monthlyPercentUsed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default OverviewSummaryTable
