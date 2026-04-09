import type { Timeframe } from '../lib/finance'

type PeriodHeaderProps = {
  selectedTimeframe: Timeframe
  periodLabel: string
  onTimeframeChange: (timeframe: Timeframe) => void
  onShiftPeriod: (amount: number) => void
}

const timeframeOptions: { value: Timeframe; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
]

function PeriodHeader({
  selectedTimeframe,
  periodLabel,
  onTimeframeChange,
  onShiftPeriod,
}: PeriodHeaderProps) {
  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Financial Tracker v1</p>
        <h1>Track your money clearly across day, week, and month.</h1>
        <p className="hero-lead">
          Log income and expenses, set total and category budgets for every
          timeframe, and instantly see whether you still have quota left or have
          already gone over.
        </p>
      </div>

      <div className="hero-controls">
        <div className="timeframe-switcher" role="tablist" aria-label="Timeframe">
          {timeframeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`timeframe-button ${
                selectedTimeframe === option.value ? 'active' : ''
              }`}
              onClick={() => onTimeframeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="period-navigation">
          <button type="button" className="nav-button" onClick={() => onShiftPeriod(-1)}>
            Previous
          </button>
          <div className="period-badge">
            <span className="period-caption">Selected period</span>
            <strong data-testid="period-label">{periodLabel}</strong>
          </div>
          <button type="button" className="nav-button" onClick={() => onShiftPeriod(1)}>
            Next
          </button>
        </div>
      </div>
    </header>
  )
}

export default PeriodHeader
