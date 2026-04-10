import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatCurrency } from '../lib/finance'
import type { CategorySummaryRow } from '../lib/finance'

type CategoryBudgetChartProps = {
  data: CategorySummaryRow[]
  currency: string
}

function CategoryBudgetChart({ data, currency }: CategoryBudgetChartProps) {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No category data yet</h3>
        <p>
          Category charts will appear after you add expenses or set category budgets.
        </p>
      </div>
    )
  }

  const chartHeight = Math.max(320, data.length * 56)

  return (
    <div className="chart-frame" data-testid="category-chart">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 12, right: 12, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(37, 52, 57, 0.08)" />
          <XAxis
            type="number"
            stroke="#5f7377"
            tickFormatter={(value: number) => formatCurrency(value, currency)}
          />
          <YAxis
            type="category"
            width={96}
            dataKey="categoryName"
            stroke="#5f7377"
          />
          <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), currency)} />
          <Legend />
          <Bar dataKey="spend" fill="#d97706" name="Spend" radius={[6, 6, 6, 6]} />
          <Bar dataKey="budget" fill="#0f766e" name="Budget" radius={[6, 6, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CategoryBudgetChart
