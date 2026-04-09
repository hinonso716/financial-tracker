import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
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
  next: BudgetRule | null
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

export const parseDateValue = (value: string | Date) =>
  value instanceof Date ? value : parseISO(value)

export const formatStorageDate = (value: string | Date) =>
  format(parseDateValue(value), 'yyyy-MM-dd')

export const formatDisplayDate = (value: string | Date) =>
  format(parseDateValue(value), 'd MMM yyyy')

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

export const getNextBudgetEffectiveFrom = (
  referenceDate: string | Date,
  timeframe: Timeframe,
  weekStartsOn: 1,
) => {
  const currentPeriod = getPeriodInterval(referenceDate, timeframe, weekStartsOn)

  switch (timeframe) {
    case 'daily':
      return formatStorageDate(addDays(currentPeriod.start, 1))
    case 'weekly':
      return formatStorageDate(addWeeks(currentPeriod.start, 1))
    case 'monthly':
      return formatStorageDate(addMonths(currentPeriod.start, 1))
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
  periodStart,
  categoryId,
}: {
  budgetRules: BudgetRule[]
  scope: BudgetScope
  timeframe: Timeframe
  periodStart: string | Date
  categoryId?: string
}) => {
  const boundary = parseDateValue(periodStart)

  return (
    budgetRules
      .filter((rule) => matchesBudgetRule(rule, scope, timeframe, categoryId))
      .filter((rule) => {
        const effective = parseDateValue(rule.effectiveFrom)
        return isBefore(effective, boundary) || isEqual(effective, boundary)
      })
      .sort(compareRuleDatesDescending)[0] ?? null
  )
}

export const getBudgetSnapshot = ({
  budgetRules,
  scope,
  timeframe,
  referenceDate,
  weekStartsOn,
  categoryId,
}: {
  budgetRules: BudgetRule[]
  scope: BudgetScope
  timeframe: Timeframe
  referenceDate: string | Date
  weekStartsOn: 1
  categoryId?: string
}): BudgetSnapshot => {
  const currentPeriod = getPeriodInterval(referenceDate, timeframe, weekStartsOn)
  const matching = budgetRules
    .filter((rule) => matchesBudgetRule(rule, scope, timeframe, categoryId))
    .sort(compareRuleDatesDescending)

  const active =
    matching.find((rule) => {
      const effective = parseDateValue(rule.effectiveFrom)
      return isBefore(effective, currentPeriod.start) || isEqual(effective, currentPeriod.start)
    }) ?? null

  const next =
    [...matching]
      .sort(
        (left, right) =>
          parseDateValue(left.effectiveFrom).getTime() -
          parseDateValue(right.effectiveFrom).getTime(),
      )
      .find((rule) => isAfter(parseDateValue(rule.effectiveFrom), currentPeriod.start)) ??
    null

  return { active, next }
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
    return (
      (isAfter(occurredAt, period.start) || isEqual(occurredAt, period.start)) &&
      (isBefore(occurredAt, period.end) || isEqual(occurredAt, period.end))
    )
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
  const spend = periodTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const income = periodTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const budgetRule = getApplicableBudgetRule({
    budgetRules,
    scope: 'total',
    timeframe,
    periodStart: period.start,
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
  const periodTransactions = getTransactionsInPeriod({
    transactions,
    anchorDate,
    timeframe,
    weekStartsOn,
  })
  const expenseCategories = categories.filter((category) => category.kind === 'expense')

  return expenseCategories
    .map((category) => {
      const spend = periodTransactions
        .filter(
          (transaction) =>
            transaction.type === 'expense' && transaction.categoryId === category.id,
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0)
      const budgetRule = getApplicableBudgetRule({
        budgetRules,
        scope: 'category',
        timeframe,
        categoryId: category.id,
        periodStart: period.start,
      })
      const budget = budgetRule?.amount ?? 0
      const hasBudget = budgetRule !== null
      const remaining = hasBudget ? budget - spend : null
      const status = !hasBudget || remaining === null
        ? 'unbudgeted'
        : remaining === 0
          ? 'exact'
          : remaining > 0
            ? 'under'
            : 'over'

      return {
        categoryId: category.id,
        categoryName: category.name,
        archived: category.archived,
        spend,
        budget,
        hasBudget,
        remaining,
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
