import {
  formatCurrency,
  formatSignedCurrency,
} from '../lib/finance'
import type { OverviewSummaryRow } from '../lib/finance'

type OverviewSummaryTableProps = {
  rows: OverviewSummaryRow[]
  overallRow: OverviewSummaryRow
  currency: string
}

const renderBudgetValue = (hasBudget: boolean, value: number, currency: string) =>
  hasBudget ? formatCurrency(value, currency) : 'No budget'

const renderRemainingValue = (
  hasBudget: boolean,
  value: number | null,
  currency: string,
) => {
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

const formatPercent = (value: number) =>
  value === 0 ? '0%' : `${value.toFixed(2)}%`

function OverviewSummaryTable({
  rows,
  overallRow,
  currency,
}: OverviewSummaryTableProps) {
  const displayRows = [...rows, overallRow]

  return (
    <div className="table-shell">
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
              <td>{renderBudgetValue(row.dailyHasBudget, row.dailyBudget, currency)}</td>
              <td>{formatCurrency(row.dailySpent, currency)}</td>
              <td className={getRemainingTone(row.dailyRemaining)}>
                {renderRemainingValue(row.dailyHasBudget, row.dailyRemaining, currency)}
              </td>
              <td>{renderBudgetValue(row.weeklyHasBudget, row.weeklyBudget, currency)}</td>
              <td>{formatCurrency(row.weeklySpent, currency)}</td>
              <td className={getRemainingTone(row.weeklyRemaining)}>
                {renderRemainingValue(row.weeklyHasBudget, row.weeklyRemaining, currency)}
              </td>
              <td>
                {renderBudgetValue(row.monthlyHasBudget, row.monthlyBudget, currency)}
              </td>
              <td>{formatCurrency(row.monthlySpent, currency)}</td>
              <td className={getRemainingTone(row.monthlyRemaining)}>
                {renderRemainingValue(
                  row.monthlyHasBudget,
                  row.monthlyRemaining,
                  currency,
                )}
              </td>
              <td>{formatPercent(row.monthlyPercentUsed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default OverviewSummaryTable
