import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export type TransactionType = 'income' | 'expense'
export type CategoryKind = TransactionType
export type BudgetScope = 'total' | 'category'
export type Timeframe = 'daily' | 'weekly' | 'monthly'

export type Transaction = {
  id: string
  type: TransactionType
  categoryId: string
  amount: number
  occurredAt: string
  note?: string
}

export type Category = {
  id: string
  name: string
  kind: CategoryKind
  archived: boolean
}

export type BudgetRule = {
  id: string
  scope: BudgetScope
  categoryId?: string
  timeframe: Timeframe
  amount: number
  effectiveFrom: string
}

export type Preferences = {
  currency: 'HKD'
  weekStartsOn: 1
}

export type AppState = {
  transactions: Transaction[]
  categories: Category[]
  budgetRules: BudgetRule[]
  preferences: Preferences
}

export type PeriodInterval = {
  start: Date
  end: Date
  label: string
  shortLabel: string
  key: string
}

export type PeriodSummary = {
  spend: number
  budget: number
  hasBudget: boolean
  remaining: number | null
  income: number
  net: number
}

export type CategorySummaryRow = {
  categoryId: string
  categoryName: string
  archived: boolean
  spend: number
  budget: number
  hasBudget: boolean
  remaining: number | null
  status: 'under' | 'over' | 'exact' | 'unbudgeted'
}

export type RollingTrendPoint = {
  key: string
  label: string
  spend: number
  budget: number
  income: number
}

export type BudgetSnapshot = {
  active: BudgetRule | null
}

export type OverviewSummaryRow = {
  categoryId: string
  categoryName: string
  archived: boolean
  dailyBudget: number
  dailySpent: number
  dailyRemaining: number | null
  dailyHasBudget: boolean
  weeklyBudget: number
  weeklySpent: number
  weeklyRemaining: number | null
  weeklyHasBudget: boolean
  monthlyBudget: number
  monthlySpent: number
  monthlyRemaining: number | null
  monthlyHasBudget: boolean
  monthlyPercentUsed: number
}

export type OverviewSummaryTotals = {
  daily: PeriodSummary
  weekly: PeriodSummary
  monthly: PeriodSummary
}

type ExpenseMetric = {
  budget: number
  spend: number
  hasBudget: boolean
  remaining: number | null
}

const PERIOD_SERIES_LENGTH: Record<Timeframe, number> = {
  daily: 7,
  weekly: 8,
  monthly: 12,
}

const currencyFormatters = new Map<string, Intl.NumberFormat>()

export const getNow = () => new Date()

const getCurrencyFormatter = (currency: string) => {
  const cached = currencyFormatters.get(currency)

  if (cached) {
    return cached
  }

  const formatter = new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  })

  currencyFormatters.set(currency, formatter)
  return formatter
}

const isOnOrBefore = (candidate: Date, boundary: Date) =>
  isBefore(candidate, boundary) || isEqual(candidate, boundary)

const sumTransactions = (
  transactions: Transaction[],
  predicate: (transaction: Transaction) => boolean,
) =>
  transactions.reduce(
    (sum, transaction) => (predicate(transaction) ? sum + transaction.amount : sum),
    0,
  )

const getExpenseMetric = ({
  transactions,
  budgetRules,
  period,
  timeframe,
  categoryId,
}: {
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  period: PeriodInterval
  timeframe: Timeframe
  categoryId?: string
}): ExpenseMetric => {
  const periodTransactions = transactions.filter((transaction) => {
    const occurredAt = parseDateValue(transaction.occurredAt)
    return (
      transaction.type === 'expense' &&
      isOnOrBefore(period.start, occurredAt) &&
      isOnOrBefore(occurredAt, period.end) &&
      (categoryId ? transaction.categoryId === categoryId : true)
    )
  })
  const spend = periodTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  )
  const budgetRule = getApplicableBudgetRule({
    budgetRules,
    scope: categoryId ? 'category' : 'total',
    timeframe,
    effectiveAt: period.end,
    categoryId,
  })
  const budget = budgetRule?.amount ?? 0
  const hasBudget = budgetRule !== null

  return {
    budget,
    spend,
    hasBudget,
    remaining: hasBudget ? budget - spend : null,
  }
}

export const parseDateValue = (value: string | Date) =>
  value instanceof Date ? value : parseISO(value)

export const formatStorageDate = (value: string | Date) =>
  format(parseDateValue(value), 'yyyy-MM-dd')

export const formatDisplayDate = (value: string | Date) =>
  format(parseDateValue(value), 'd MMM yyyy')

export const formatDisplayDateTime = (value: string | Date) =>
  format(parseDateValue(value), 'd MMM yyyy, h:mm a')

export const formatCurrency = (value: number, currency = 'HKD') =>
  getCurrencyFormatter(currency).format(value)

export const formatSignedCurrency = (value: number, currency = 'HKD') => {
  if (value === 0) {
    return formatCurrency(0, currency)
  }

  const sign = value > 0 ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(value), currency)}`
}

export const getPeriodInterval = (
  anchorDate: string | Date,
  timeframe: Timeframe,
  weekStartsOn: 1,
): PeriodInterval => {
  const date = parseDateValue(anchorDate)

  switch (timeframe) {
    case 'daily': {
      const start = startOfDay(date)
      const end = endOfDay(date)

      return {
        start,
        end,
        key: formatStorageDate(start),
        label: format(start, 'EEEE, d MMMM yyyy'),
        shortLabel: format(start, 'd MMM'),
      }
    }

    case 'weekly': {
      const start = startOfWeek(date, { weekStartsOn })
      const end = endOfWeek(date, { weekStartsOn })

      return {
        start,
        end,
        key: formatStorageDate(start),
        label: `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`,
        shortLabel: format(start, 'd MMM'),
      }
    }

    case 'monthly': {
      const start = startOfMonth(date)
      const end = endOfMonth(date)

      return {
        start,
        end,
        key: formatStorageDate(start),
        label: format(start, 'MMMM yyyy'),
        shortLabel: format(start, 'MMM'),
      }
    }
  }
}

export const shiftAnchorDate = (
  anchorDate: string | Date,
  timeframe: Timeframe,
  amount: number,
) => {
  const date = parseDateValue(anchorDate)

  switch (timeframe) {
    case 'daily':
      return formatStorageDate(addDays(date, amount))
    case 'weekly':
      return formatStorageDate(addWeeks(date, amount))
    case 'monthly':
      return formatStorageDate(addMonths(date, amount))
  }
}

const matchesBudgetRule = (
  rule: BudgetRule,
  scope: BudgetScope,
  timeframe: Timeframe,
  categoryId?: string,
) =>
  rule.scope === scope &&
  rule.timeframe === timeframe &&
  (scope === 'total' ? !rule.categoryId : rule.categoryId === categoryId)

const compareRuleDatesDescending = (left: BudgetRule, right: BudgetRule) =>
  parseDateValue(right.effectiveFrom).getTime() -
  parseDateValue(left.effectiveFrom).getTime()

export const getApplicableBudgetRule = ({
  budgetRules,
  scope,
  timeframe,
  effectiveAt,
  categoryId,
}: {
  budgetRules: BudgetRule[]
  scope: BudgetScope
  timeframe: Timeframe
  effectiveAt: string | Date
  categoryId?: string
}) => {
  const boundary = parseDateValue(effectiveAt)

  return (
    budgetRules
      .filter((rule) => matchesBudgetRule(rule, scope, timeframe, categoryId))
      .filter((rule) => isOnOrBefore(parseDateValue(rule.effectiveFrom), boundary))
      .sort(compareRuleDatesDescending)[0] ?? null
  )
}

export const getBudgetSnapshot = ({
  budgetRules,
  scope,
  timeframe,
  referenceDate,
  categoryId,
}: {
  budgetRules: BudgetRule[]
  scope: BudgetScope
  timeframe: Timeframe
  referenceDate: string | Date
  categoryId?: string
}): BudgetSnapshot => ({
  active: getApplicableBudgetRule({
    budgetRules,
    scope,
    timeframe,
    effectiveAt: referenceDate,
    categoryId,
  }),
})

export const getTransactionsInPeriod = ({
  transactions,
  anchorDate,
  timeframe,
  weekStartsOn,
}: {
  transactions: Transaction[]
  anchorDate: string | Date
  timeframe: Timeframe
  weekStartsOn: 1
}) => {
  const period = getPeriodInterval(anchorDate, timeframe, weekStartsOn)

  return transactions.filter((transaction) => {
    const occurredAt = parseDateValue(transaction.occurredAt)
    return isOnOrBefore(period.start, occurredAt) && isOnOrBefore(occurredAt, period.end)
  })
}

export const getPeriodSummary = ({
  transactions,
  budgetRules,
  anchorDate,
  timeframe,
  weekStartsOn,
}: {
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  anchorDate: string | Date
  timeframe: Timeframe
  weekStartsOn: 1
}): PeriodSummary => {
  const period = getPeriodInterval(anchorDate, timeframe, weekStartsOn)
  const periodTransactions = getTransactionsInPeriod({
    transactions,
    anchorDate,
    timeframe,
    weekStartsOn,
  })
  const spend = sumTransactions(
    periodTransactions,
    (transaction) => transaction.type === 'expense',
  )
  const income = sumTransactions(
    periodTransactions,
    (transaction) => transaction.type === 'income',
  )
  const budgetRule = getApplicableBudgetRule({
    budgetRules,
    scope: 'total',
    timeframe,
    effectiveAt: period.end,
  })
  const budget = budgetRule?.amount ?? 0
  const hasBudget = budgetRule !== null

  return {
    spend,
    budget,
    hasBudget,
    remaining: hasBudget ? budget - spend : null,
    income,
    net: income - spend,
  }
}

export const getCategorySummaryRows = ({
  categories,
  transactions,
  budgetRules,
  anchorDate,
  timeframe,
  weekStartsOn,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  anchorDate: string | Date
  timeframe: Timeframe
  weekStartsOn: 1
}): CategorySummaryRow[] => {
  const period = getPeriodInterval(anchorDate, timeframe, weekStartsOn)
  const expenseCategories = categories.filter((category) => category.kind === 'expense')

  return expenseCategories
    .map((category) => {
      const metric = getExpenseMetric({
        transactions,
        budgetRules,
        period,
        timeframe,
        categoryId: category.id,
      })
      const status = !metric.hasBudget || metric.remaining === null
        ? 'unbudgeted'
        : metric.remaining === 0
          ? 'exact'
          : metric.remaining > 0
            ? 'under'
            : 'over'

      return {
        categoryId: category.id,
        categoryName: category.name,
        archived: category.archived,
        spend: metric.spend,
        budget: metric.budget,
        hasBudget: metric.hasBudget,
        remaining: metric.remaining,
        status,
      } satisfies CategorySummaryRow
    })
    .filter((row) => !row.archived || row.spend > 0 || row.hasBudget)
    .sort((left, right) => {
      if (left.archived !== right.archived) {
        return Number(left.archived) - Number(right.archived)
      }

      if (left.spend !== right.spend) {
        return right.spend - left.spend
      }

      return left.categoryName.localeCompare(right.categoryName)
    })
}

export const getRollingTrendSeries = ({
  transactions,
  budgetRules,
  timeframe,
  anchorDate,
  weekStartsOn,
}: {
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  timeframe: Timeframe
  anchorDate: string | Date
  weekStartsOn: 1
}) => {
  const period = getPeriodInterval(anchorDate, timeframe, weekStartsOn)
  const count = PERIOD_SERIES_LENGTH[timeframe]

  return Array.from({ length: count }, (_, index) => {
    const offset = index - (count - 1)
    const currentDate =
      timeframe === 'daily'
        ? addDays(period.start, offset)
        : timeframe === 'weekly'
          ? addWeeks(period.start, offset)
          : addMonths(period.start, offset)
    const currentPeriod = getPeriodInterval(currentDate, timeframe, weekStartsOn)
    const summary = getPeriodSummary({
      transactions,
      budgetRules,
      anchorDate: currentDate,
      timeframe,
      weekStartsOn,
    })

    return {
      key: currentPeriod.key,
      label: currentPeriod.shortLabel,
      spend: summary.spend,
      budget: summary.budget,
      income: summary.income,
    } satisfies RollingTrendPoint
  })
}

export const getOverviewTotals = ({
  transactions,
  budgetRules,
  referenceDate,
  weekStartsOn,
}: {
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  referenceDate: string | Date
  weekStartsOn: 1
}): OverviewSummaryTotals => ({
  daily: getPeriodSummary({
    transactions,
    budgetRules,
    anchorDate: referenceDate,
    timeframe: 'daily',
    weekStartsOn,
  }),
  weekly: getPeriodSummary({
    transactions,
    budgetRules,
    anchorDate: referenceDate,
    timeframe: 'weekly',
    weekStartsOn,
  }),
  monthly: getPeriodSummary({
    transactions,
    budgetRules,
    anchorDate: referenceDate,
    timeframe: 'monthly',
    weekStartsOn,
  }),
})

export const getOverviewSummaryRows = ({
  categories,
  transactions,
  budgetRules,
  referenceDate,
  weekStartsOn,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  referenceDate: string | Date
  weekStartsOn: 1
}) => {
  const dailyPeriod = getPeriodInterval(referenceDate, 'daily', weekStartsOn)
  const weeklyPeriod = getPeriodInterval(referenceDate, 'weekly', weekStartsOn)
  const monthlyPeriod = getPeriodInterval(referenceDate, 'monthly', weekStartsOn)
  const expenseCategories = categories.filter((category) => category.kind === 'expense')

  return expenseCategories
    .map((category) => {
      const daily = getExpenseMetric({
        transactions,
        budgetRules,
        period: dailyPeriod,
        timeframe: 'daily',
        categoryId: category.id,
      })
      const weekly = getExpenseMetric({
        transactions,
        budgetRules,
        period: weeklyPeriod,
        timeframe: 'weekly',
        categoryId: category.id,
      })
      const monthly = getExpenseMetric({
        transactions,
        budgetRules,
        period: monthlyPeriod,
        timeframe: 'monthly',
        categoryId: category.id,
      })
      const monthlyPercentUsed =
        monthly.budget > 0 ? (monthly.spend / monthly.budget) * 100 : 0

      return {
        categoryId: category.id,
        categoryName: category.name,
        archived: category.archived,
        dailyBudget: daily.budget,
        dailySpent: daily.spend,
        dailyRemaining: daily.remaining,
        dailyHasBudget: daily.hasBudget,
        weeklyBudget: weekly.budget,
        weeklySpent: weekly.spend,
        weeklyRemaining: weekly.remaining,
        weeklyHasBudget: weekly.hasBudget,
        monthlyBudget: monthly.budget,
        monthlySpent: monthly.spend,
        monthlyRemaining: monthly.remaining,
        monthlyHasBudget: monthly.hasBudget,
        monthlyPercentUsed,
      } satisfies OverviewSummaryRow
    })
    .filter(
      (row) =>
        !row.archived ||
        row.dailySpent > 0 ||
        row.weeklySpent > 0 ||
        row.monthlySpent > 0 ||
        row.dailyHasBudget ||
        row.weeklyHasBudget ||
        row.monthlyHasBudget,
    )
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName))
}

export const getCategoryName = (categories: Category[], categoryId: string) =>
  categories.find((category) => category.id === categoryId)?.name ?? 'Unknown category'

export const getActiveCategories = (categories: Category[], kind: CategoryKind) =>
  categories.filter((category) => category.kind === kind && !category.archived)

export const getCategoryOptions = ({
  categories,
  kind,
  includeCategoryId,
}: {
  categories: Category[]
  kind: CategoryKind
  includeCategoryId?: string
}) =>
  categories.filter(
    (category) =>
      category.kind === kind &&
      (!category.archived || category.id === includeCategoryId),
  )
