import { formatCurrency, formatSignedCurrency } from '../lib/finance'

type BudgetSummaryTableProps = {
  rows: {
    categoryId: string
    categoryName: string
    budget: number
    hasBudget: boolean
    spend: number
    remaining: number | null
    status: string
  }[]
  currency: string
}

const getRemainingTone = (remaining: number | null) => {
  if (remaining === null || remaining === 0) {
    return 'neutral'
  }

  return remaining > 0 ? 'positive' : 'negative'
}

function BudgetSummaryTable({ rows, currency }: BudgetSummaryTableProps) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            <th>Target</th>
            <th>Budget</th>
            <th>Spent</th>
            <th>Remaining</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.categoryId}>
              <th>{row.categoryName}</th>
              <td>{row.hasBudget ? formatCurrency(row.budget, currency) : 'No budget'}</td>
              <td>{formatCurrency(row.spend, currency)}</td>
              <td className={getRemainingTone(row.remaining)}>
                {row.remaining === null
                  ? 'No budget'
                  : formatSignedCurrency(row.remaining, currency)}
              </td>
              <td>
                <span
                  className={`status-pill ${
                    row.status === 'Under budget'
                      ? 'positive'
                      : row.status === 'Over budget'
                        ? 'negative'
                        : 'neutral'
                  }`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default BudgetSummaryTable
