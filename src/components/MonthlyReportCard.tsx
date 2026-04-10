import { formatCurrency, formatSignedCurrency } from '../lib/finance'
import type { MonthlyReport } from '../lib/finance'

type MonthlyReportCardProps = {
  report: MonthlyReport
  currency: string
}

const getChangeTone = (value: number | null) => {
  if (value === null || value === 0) {
    return 'neutral'
  }

  return value > 0 ? 'positive' : 'negative'
}

const formatChangeLabel = (value: number | null) => {
  if (value === null) {
    return 'No last-month baseline'
  }

  if (value === 0) {
    return '0.0% vs last month'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}% vs last month`
}

function MonthlyReportCard({ report, currency }: MonthlyReportCardProps) {
  return (
    <article className="monthly-report-card" data-testid="monthly-report-card">
      <div className="monthly-report-hero">
        <div>
          <p className="eyebrow">Monthly Report</p>
          <h3>{report.monthLabel}</h3>
        </div>
        <div className={`monthly-report-change ${getChangeTone(report.balanceChangePct)}`}>
          <span>Balance trend</span>
          <strong>{formatChangeLabel(report.balanceChangePct)}</strong>
        </div>
      </div>

      <div className="monthly-report-balance">
        <span className="summary-label">Balance</span>
        <strong>{formatSignedCurrency(report.balance, currency)}</strong>
        <p>
          {formatCurrency(report.incomeTotal, currency)} income less{' '}
          {formatCurrency(report.expenseTotal, currency)} expenses
        </p>
      </div>

      <div className="monthly-report-grid">
        <section className="monthly-report-section">
          <div className="monthly-report-section-header">
            <h4>Income</h4>
            <strong>{formatCurrency(report.incomeTotal, currency)}</strong>
          </div>
          {report.incomeRows.length > 0 ? (
            <div className="monthly-report-list">
              {report.incomeRows.map((row) => (
                <div className="monthly-report-row" key={row.categoryId}>
                  <span>{row.categoryName}</span>
                  <strong className="positive">
                    {formatCurrency(row.amount, currency)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="monthly-report-empty">No income logged this month.</p>
          )}
        </section>

        <section className="monthly-report-section">
          <div className="monthly-report-section-header">
            <h4>Expenses</h4>
            <strong>{formatCurrency(report.expenseTotal, currency)}</strong>
          </div>
          {report.expenseRows.length > 0 ? (
            <div className="monthly-report-list">
              {report.expenseRows.map((row) => (
                <div className="monthly-report-row" key={row.categoryId}>
                  <span>{row.categoryName}</span>
                  <strong className="negative">
                    {formatCurrency(row.amount, currency)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="monthly-report-empty">No expenses logged this month.</p>
          )}
        </section>
      </div>
    </article>
  )
}

export default MonthlyReportCard
