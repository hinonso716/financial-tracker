import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
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
  description?: string
  remarks?: string
  note?: string
}

export type Category = {
  id: string
  name: string
  kind: CategoryKind
  archived: boolean
  sortOrder?: number
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
  showDailyBudget: boolean
  showWeeklyBudget: boolean
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
  active: {
    amount: number
    effectiveFrom: string
    derived: boolean
  } | null
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

export type MonthlyReportRow = {
  categoryId: string
  categoryName: string
  amount: number
}

export type MonthlyReport = {
  bannerLabel: string
  monthLabel: string
  incomeRows: MonthlyReportRow[]
  expenseRows: MonthlyReportRow[]
  incomeTotal: number
  expenseTotal: number
  balance: number
  balanceChangePct: number | null
}

type BudgetMetric = {
  budget: number
  hasBudget: boolean
  effectiveFrom: string | null
}

type ExpenseMetric = BudgetMetric & {
  spend: number
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

const getCategorySortValue = (category: Category) =>
  category.sortOrder ?? Number.MAX_SAFE_INTEGER

const sortCategoriesByPreference = (categories: Category[]) =>
  [...categories].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind)
    }

    const orderDelta = getCategorySortValue(left) - getCategorySortValue(right)

    if (orderDelta !== 0) {
      return orderDelta
    }

    return left.name.localeCompare(right.name)
  })

const getOrderedCategoriesByKind = (
  categories: Category[],
  kind: CategoryKind,
  includeArchived = true,
) =>
  sortCategoriesByPreference(
    categories.filter(
      (category) =>
        category.kind === kind && (includeArchived || !category.archived),
    ),
  )

const isBudgetTimeframeEnabled = (
  timeframe: Timeframe,
  preferences: Preferences,
) => {
  if (timeframe === 'monthly') {
    return true
  }

  if (timeframe === 'daily') {
    return preferences.showDailyBudget
  }

  return preferences.showWeeklyBudget
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

const mergeBudgetMetrics = (metrics: BudgetMetric[]): BudgetMetric => {
  const withBudget = metrics.filter((metric) => metric.hasBudget)

  if (withBudget.length === 0) {
    return {
      budget: 0,
      hasBudget: false,
      effectiveFrom: null,
    }
  }

  const latestEffectiveFrom =
    withBudget
      .map((metric) => metric.effectiveFrom)
      .filter((value): value is string => typeof value === 'string')
      .sort((left, right) => right.localeCompare(left))[0] ?? null

  return {
    budget: withBudget.reduce((sum, metric) => sum + metric.budget, 0),
    hasBudget: true,
    effectiveFrom: latestEffectiveFrom,
  }
}

const getCategoryBudgetMetricForDate = ({
  budgetRules,
  categoryId,
  date,
}: {
  budgetRules: BudgetRule[]
  categoryId: string
  date: string | Date
}): BudgetMetric => {
  const monthlyRule = getApplicableBudgetRule({
    budgetRules,
    scope: 'category',
    timeframe: 'monthly',
    categoryId,
    effectiveAt: endOfDay(parseDateValue(date)),
  })

  if (!monthlyRule) {
    return {
      budget: 0,
      hasBudget: false,
      effectiveFrom: null,
    }
  }

  return {
    budget: monthlyRule.amount,
    hasBudget: true,
    effectiveFrom: monthlyRule.effectiveFrom,
  }
}

const getMonthlyBudgetMetric = ({
  categories,
  budgetRules,
  categoryId,
  effectiveAt,
}: {
  categories: Category[]
  budgetRules: BudgetRule[]
  categoryId?: string
  effectiveAt: string | Date
}): BudgetMetric => {
  if (categoryId) {
    return getCategoryBudgetMetricForDate({
      budgetRules,
      categoryId,
      date: effectiveAt,
    })
  }

  return mergeBudgetMetrics(
    getOrderedCategoriesByKind(categories, 'expense').map((category) =>
      getCategoryBudgetMetricForDate({
        budgetRules,
        categoryId: category.id,
        date: effectiveAt,
      }),
    ),
  )
}

const getDailyBudgetMetric = ({
  categories,
  budgetRules,
  categoryId,
  date,
  preferences,
}: {
  categories: Category[]
  budgetRules: BudgetRule[]
  categoryId?: string
  date: Date
  preferences: Preferences
}): BudgetMetric => {
  if (!preferences.showDailyBudget) {
    return {
      budget: 0,
      hasBudget: false,
      effectiveFrom: null,
    }
  }

  const contributionForMetric = (metric: BudgetMetric): BudgetMetric => {
    if (!metric.hasBudget) {
      return metric
    }

    return {
      ...metric,
      budget: metric.budget / getDaysInMonth(date),
    }
  }

  if (categoryId) {
    return contributionForMetric(
      getCategoryBudgetMetricForDate({
        budgetRules,
        categoryId,
        date,
      }),
    )
  }

  return mergeBudgetMetrics(
    getOrderedCategoriesByKind(categories, 'expense').map((category) =>
      contributionForMetric(
        getCategoryBudgetMetricForDate({
          budgetRules,
          categoryId: category.id,
          date,
        }),
      ),
    ),
  )
}

const getBudgetMetricForPeriod = ({
  categories,
  budgetRules,
  period,
  timeframe,
  categoryId,
  preferences,
}: {
  categories: Category[]
  budgetRules: BudgetRule[]
  period: PeriodInterval
  timeframe: Timeframe
  categoryId?: string
  preferences: Preferences
}): BudgetMetric => {
  if (timeframe === 'monthly') {
    return getMonthlyBudgetMetric({
      categories,
      budgetRules,
      categoryId,
      effectiveAt: period.end,
    })
  }

  if (!isBudgetTimeframeEnabled(timeframe, preferences)) {
    return {
      budget: 0,
      hasBudget: false,
      effectiveFrom: null,
    }
  }

  const dailyMetrics = eachDayOfInterval({
    start: startOfDay(period.start),
    end: startOfDay(period.end),
  }).map((date) =>
    getDailyBudgetMetric({
      categories,
      budgetRules,
      categoryId,
      date,
      preferences,
    }),
  )

  return mergeBudgetMetrics(dailyMetrics)
}

const getExpenseMetric = ({
  categories,
  transactions,
  budgetRules,
  period,
  timeframe,
  preferences,
  categoryId,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  period: PeriodInterval
  timeframe: Timeframe
  preferences: Preferences
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
  const budgetMetric = getBudgetMetricForPeriod({
    categories,
    budgetRules,
    period,
    timeframe,
    categoryId,
    preferences,
  })

  return {
    budget: budgetMetric.budget,
    spend,
    hasBudget: budgetMetric.hasBudget,
    effectiveFrom: budgetMetric.effectiveFrom,
    remaining: budgetMetric.hasBudget ? budgetMetric.budget - spend : null,
  }
}

const groupMonthlyTransactionsByCategory = ({
  categories,
  transactions,
  type,
}: {
  categories: Category[]
  transactions: Transaction[]
  type: TransactionType
}) => {
  const orderedCategories = getOrderedCategoriesByKind(categories, type)

  return orderedCategories
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      amount: transactions
        .filter((transaction) => transaction.type === type)
        .filter((transaction) => transaction.categoryId === category.id)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }))
    .filter((row) => row.amount > 0)
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

export const getTransactionDescription = (transaction: Transaction) =>
  transaction.description?.trim() || transaction.note?.trim() || ''

export const getTransactionRemarks = (transaction: Transaction) =>
  transaction.remarks?.trim() || ''

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
  categories,
  budgetRules,
  timeframe,
  referenceDate,
  categoryId,
  preferences,
  weekStartsOn,
}: {
  categories: Category[]
  budgetRules: BudgetRule[]
  timeframe: Timeframe
  referenceDate: string | Date
  categoryId?: string
  preferences: Preferences
  weekStartsOn: 1
}): BudgetSnapshot => {
  const period = getPeriodInterval(referenceDate, timeframe, weekStartsOn)
  const metric = getBudgetMetricForPeriod({
    categories,
    budgetRules,
    period,
    timeframe,
    categoryId,
    preferences,
  })

  if (!metric.hasBudget) {
    return { active: null }
  }

  return {
    active: {
      amount: metric.budget,
      effectiveFrom: metric.effectiveFrom ?? parseDateValue(referenceDate).toISOString(),
      derived: timeframe !== 'monthly' || !categoryId,
    },
  }
}

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
  categories,
  transactions,
  budgetRules,
  anchorDate,
  timeframe,
  weekStartsOn,
  preferences,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  anchorDate: string | Date
  timeframe: Timeframe
  weekStartsOn: 1
  preferences: Preferences
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
  const budgetMetric = getBudgetMetricForPeriod({
    categories,
    budgetRules,
    period,
    timeframe,
    preferences,
  })

  return {
    spend,
    budget: budgetMetric.budget,
    hasBudget: budgetMetric.hasBudget,
    remaining: budgetMetric.hasBudget ? budgetMetric.budget - spend : null,
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
  preferences,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  anchorDate: string | Date
  timeframe: Timeframe
  weekStartsOn: 1
  preferences: Preferences
}): CategorySummaryRow[] => {
  const period = getPeriodInterval(anchorDate, timeframe, weekStartsOn)
  const expenseCategories = getOrderedCategoriesByKind(categories, 'expense')

  return expenseCategories
    .map((category) => {
      const metric = getExpenseMetric({
        categories,
        transactions,
        budgetRules,
        period,
        timeframe,
        categoryId: category.id,
        preferences,
      })
      const status =
        !metric.hasBudget || metric.remaining === null
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
}

export const getRollingTrendSeries = ({
  categories,
  transactions,
  budgetRules,
  timeframe,
  anchorDate,
  weekStartsOn,
  preferences,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  timeframe: Timeframe
  anchorDate: string | Date
  weekStartsOn: 1
  preferences: Preferences
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
      categories,
      transactions,
      budgetRules,
      anchorDate: currentDate,
      timeframe,
      weekStartsOn,
      preferences,
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
  categories,
  transactions,
  budgetRules,
  referenceDate,
  weekStartsOn,
  preferences,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  referenceDate: string | Date
  weekStartsOn: 1
  preferences: Preferences
}): OverviewSummaryTotals => ({
  daily: getPeriodSummary({
    categories,
    transactions,
    budgetRules,
    anchorDate: referenceDate,
    timeframe: 'daily',
    weekStartsOn,
    preferences,
  }),
  weekly: getPeriodSummary({
    categories,
    transactions,
    budgetRules,
    anchorDate: referenceDate,
    timeframe: 'weekly',
    weekStartsOn,
    preferences,
  }),
  monthly: getPeriodSummary({
    categories,
    transactions,
    budgetRules,
    anchorDate: referenceDate,
    timeframe: 'monthly',
    weekStartsOn,
    preferences,
  }),
})

export const getOverviewSummaryRows = ({
  categories,
  transactions,
  budgetRules,
  referenceDate,
  weekStartsOn,
  preferences,
}: {
  categories: Category[]
  transactions: Transaction[]
  budgetRules: BudgetRule[]
  referenceDate: string | Date
  weekStartsOn: 1
  preferences: Preferences
}) => {
  const dailyPeriod = getPeriodInterval(referenceDate, 'daily', weekStartsOn)
  const weeklyPeriod = getPeriodInterval(referenceDate, 'weekly', weekStartsOn)
  const monthlyPeriod = getPeriodInterval(referenceDate, 'monthly', weekStartsOn)
  const expenseCategories = getOrderedCategoriesByKind(categories, 'expense')

  return expenseCategories
    .map((category) => {
      const daily = getExpenseMetric({
        categories,
        transactions,
        budgetRules,
        period: dailyPeriod,
        timeframe: 'daily',
        categoryId: category.id,
        preferences,
      })
      const weekly = getExpenseMetric({
        categories,
        transactions,
        budgetRules,
        period: weeklyPeriod,
        timeframe: 'weekly',
        categoryId: category.id,
        preferences,
      })
      const monthly = getExpenseMetric({
        categories,
        transactions,
        budgetRules,
        period: monthlyPeriod,
        timeframe: 'monthly',
        categoryId: category.id,
        preferences,
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
}

export const getMonthlyReport = ({
  categories,
  transactions,
  anchorDate,
}: {
  categories: Category[]
  transactions: Transaction[]
  anchorDate: string | Date
}): MonthlyReport => {
  const currentPeriod = getPeriodInterval(anchorDate, 'monthly', 1)
  const previousPeriod = getPeriodInterval(
    subMonths(currentPeriod.start, 1),
    'monthly',
    1,
  )
  const currentTransactions = getTransactionsInPeriod({
    transactions,
    anchorDate: currentPeriod.start,
    timeframe: 'monthly',
    weekStartsOn: 1,
  })
  const previousTransactions = getTransactionsInPeriod({
    transactions,
    anchorDate: previousPeriod.start,
    timeframe: 'monthly',
    weekStartsOn: 1,
  })

  const incomeRows = groupMonthlyTransactionsByCategory({
    categories,
    transactions: currentTransactions,
    type: 'income',
  })
  const expenseRows = groupMonthlyTransactionsByCategory({
    categories,
    transactions: currentTransactions,
    type: 'expense',
  })
  const incomeTotal = incomeRows.reduce((sum, row) => sum + row.amount, 0)
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0)
  const balance = incomeTotal - expenseTotal
  const previousBalance =
    sumTransactions(previousTransactions, (transaction) => transaction.type === 'income') -
    sumTransactions(previousTransactions, (transaction) => transaction.type === 'expense')

  return {
    bannerLabel: format(currentPeriod.start, 'MMMM').toUpperCase(),
    monthLabel: format(currentPeriod.start, 'MMMM yyyy'),
    incomeRows,
    expenseRows,
    incomeTotal,
    expenseTotal,
    balance,
    balanceChangePct:
      previousBalance === 0
        ? null
        : ((balance - previousBalance) / Math.abs(previousBalance)) * 100,
  }
}

export const getCategoryName = (categories: Category[], categoryId: string) =>
  categories.find((category) => category.id === categoryId)?.name ?? 'Unknown category'

export const getActiveCategories = (categories: Category[], kind: CategoryKind) =>
  getOrderedCategoriesByKind(categories, kind, false)

export const getCategoryOptions = ({
  categories,
  kind,
  includeCategoryId,
}: {
  categories: Category[]
  kind: CategoryKind
  includeCategoryId?: string
}) =>
  getOrderedCategoriesByKind(categories, kind).filter(
    (category) => !category.archived || category.id === includeCategoryId,
  )
