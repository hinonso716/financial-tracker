import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatCurrency } from '../lib/finance'
import type { RollingTrendPoint } from '../lib/finance'

type TrendChartProps = {
  data: RollingTrendPoint[]
  currency: string
  empty: boolean
}

function TrendChart({ data, currency, empty }: TrendChartProps) {
  if (empty) {
    return (
      <div className="empty-state">
        <h3>No chart data yet</h3>
        <p>Add transactions or budgets to see spending trends over time.</p>
      </div>
    )
  }

  return (
    <div className="chart-frame" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(37, 52, 57, 0.08)" />
          <XAxis dataKey="label" stroke="#5f7377" />
          <YAxis
            stroke="#5f7377"
            tickFormatter={(value: number) => formatCurrency(value, currency)}
          />
          <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), currency)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#d97706"
            strokeWidth={3}
            name="Spend"
          />
          <Line
            type="monotone"
            dataKey="budget"
            stroke="#0f766e"
            strokeWidth={3}
            name="Budget"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TrendChart
