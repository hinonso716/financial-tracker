type SummaryCardProps = {
  label: string
  value: string
  helpText: string
  tone?: 'neutral' | 'positive' | 'negative'
  testId?: string
}

function SummaryCard({
  label,
  value,
  helpText,
  tone = 'neutral',
  testId,
}: SummaryCardProps) {
  return (
    <article className={`summary-card ${tone}`} data-testid={testId}>
      <span className="summary-label">{label}</span>
      <strong className="summary-value">{value}</strong>
      <p className="summary-help">{helpText}</p>
    </article>
  )
}

export default SummaryCard
