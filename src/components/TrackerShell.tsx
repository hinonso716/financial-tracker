import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

import BottomNav from './BottomNav'
import BudgetManager from './BudgetManager'
import CategoryBudgetChart from './CategoryBudgetChart'
import CategoryManager from './CategoryManager'
import OverviewSummaryTable from './OverviewSummaryTable'
import Panel from './Panel'
import SummaryCard from './SummaryCard'
import TransactionEditor from './TransactionEditor'
import TransactionsTable from './TransactionsTable'
import TrendChart from './TrendChart'
import {
  createBudgetRuleId,
  createCategoryId,
  createTransactionId,
} from '../lib/defaults'
import {
  formatCurrency,
  formatSignedCurrency,
  formatStorageDate,
  getActiveCategories,
  getBudgetSnapshot,
  getCategoryName,
  getCategoryOptions,
  getCategorySummaryRows,
  getNow,
  getOverviewSummaryRows,
  getOverviewTotals,
  getPeriodInterval,
  getPeriodSummary,
  getRollingTrendSeries,
  getTransactionsInPeriod,
  parseDateValue,
  shiftAnchorDate,
} from '../lib/finance'
import type {
  AppState,
  BudgetRule,
  BudgetScope,
  Category,
  CategoryKind,
  OverviewSummaryRow,
  Timeframe,
  Transaction,
  TransactionType,
} from '../lib/finance'
import type { AppUser } from '../lib/backend'

type AppTab = 'input' | 'manage' | 'records' | 'overview'

type TransactionFormState = {
  type: TransactionType
  categoryId: string
  amount: string
  occurredAt: string
  note: string
}

type BudgetFormState = {
  scope: BudgetScope
  categoryId: string
  timeframe: Timeframe
  amount: string
}

type TrackerShellProps = {
  appState: AppState
  user: AppUser
  onSignOut: () => Promise<void>
  onCreateTransaction: (transaction: Transaction) => Promise<void>
  onUpdateTransaction: (transaction: Transaction) => Promise<void>
  onDeleteTransaction: (transactionId: string) => Promise<void>
  onCreateCategory: (category: Category) => Promise<void>
  onUpdateCategory: (category: Category) => Promise<void>
  onCreateBudgetRule: (budgetRule: BudgetRule) => Promise<void>
}

const tabItems: { id: AppTab; label: string; description: string }[] = [
  {
    id: 'input',
    label: 'Input',
    description: 'Add or edit transactions quickly without the rest of the dashboard getting in the way.',
  },
  {
    id: 'manage',
    label: 'Manage',
    description: 'Create categories and update daily, weekly, and monthly budgets whenever you need to.',
  },
  {
    id: 'records',
    label: 'Records',
    description: 'Browse transactions by period, filter them, and jump into edits from one place.',
  },
  {
    id: 'overview',
    label: 'Overview',
    description: 'See the summary table, current budget position, and clearer charts in one dashboard tab.',
  },
]

const timeframeOptions: { value: Timeframe; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
]

const recordsTimeframeLabels: Record<Timeframe, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
}

const createTransactionFormState = (
  categories: Category[],
  type: TransactionType = 'expense',
): TransactionFormState => ({
  type,
  categoryId: getActiveCategories(categories, type)[0]?.id ?? '',
  amount: '',
  occurredAt: formatStorageDate(getNow()),
  note: '',
})

const createBudgetFormState = (categories: Category[]): BudgetFormState => ({
  scope: 'total',
  categoryId: getActiveCategories(categories, 'expense')[0]?.id ?? '',
  timeframe: 'weekly',
  amount: '',
})

const sortTransactionsNewestFirst = (left: Transaction, right: Transaction) => {
  const dateDelta =
    parseDateValue(right.occurredAt).getTime() -
    parseDateValue(left.occurredAt).getTime()

  if (dateDelta !== 0) {
    return dateDelta
  }

  return right.id.localeCompare(left.id)
}

const getRemainingTone = (remaining: number | null) => {
  if (remaining === null || remaining === 0) {
    return 'neutral'
  }

  return remaining > 0 ? 'positive' : 'negative'
}

const getSummaryValue = (
  value: number | null,
  currency: string,
  signed = false,
) => {
  if (value === null) {
    return 'No budget'
  }

  return signed ? formatSignedCurrency(value, currency) : formatCurrency(value, currency)
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.'

function TrackerShell({
  appState,
  user,
  onSignOut,
  onCreateTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onCreateCategory,
  onUpdateCategory,
  onCreateBudgetRule,
}: TrackerShellProps) {
  const [activeTab, setActiveTab] = useState<AppTab>('overview')
  const [recordsTimeframe, setRecordsTimeframe] = useState<Timeframe>('weekly')
  const [recordsAnchorDate, setRecordsAnchorDate] = useState(() =>
    formatStorageDate(getNow()),
  )
  const [overviewTrendTimeframe, setOverviewTrendTimeframe] =
    useState<Timeframe>('monthly')
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(
    null,
  )
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(() =>
    createTransactionFormState(appState.categories),
  )
  const [transactionNotice, setTransactionNotice] = useState('')
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    'all' | TransactionType
  >('all')
  const [transactionCategoryFilter, setTransactionCategoryFilter] =
    useState<string>('all')
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(() =>
    createBudgetFormState(appState.categories),
  )
  const [budgetNotice, setBudgetNotice] = useState('')
  const [categoryNotice, setCategoryNotice] = useState('')
  const [categoryForm, setCategoryForm] = useState<{
    name: string
    kind: CategoryKind
  }>({ name: '', kind: 'expense' })
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      appState.categories.map((category) => [category.id, category.name]),
    ),
  )
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [headerMessage, setHeaderMessage] = useState('')

  const { transactions, categories, budgetRules, preferences } = appState
  const currency = preferences.currency
  const weekStartsOn = preferences.weekStartsOn
  const now = getNow()
  const currentDateValue = formatStorageDate(now)
  const currentTimestamp = now.toISOString()

  const activeExpenseCategories = useMemo(
    () => getActiveCategories(categories, 'expense'),
    [categories],
  )

  const transactionCategoryOptions = useMemo(
    () =>
      getCategoryOptions({
        categories,
        kind: transactionForm.type,
        includeCategoryId: editingTransactionId ? transactionForm.categoryId : undefined,
      }),
    [categories, editingTransactionId, transactionForm.categoryId, transactionForm.type],
  )

  const resolvedTransactionForm = useMemo(
    () =>
      transactionCategoryOptions.some(
        (category) => category.id === transactionForm.categoryId,
      )
        ? transactionForm
        : {
            ...transactionForm,
            categoryId: transactionCategoryOptions[0]?.id ?? '',
          },
    [transactionCategoryOptions, transactionForm],
  )

  const resolvedBudgetForm = useMemo(
    () =>
      budgetForm.scope === 'category' &&
      !activeExpenseCategories.some(
        (category) => category.id === budgetForm.categoryId,
      )
        ? {
            ...budgetForm,
            categoryId: activeExpenseCategories[0]?.id ?? '',
          }
        : budgetForm,
    [activeExpenseCategories, budgetForm],
  )

  const recordsPeriod = useMemo(
    () => getPeriodInterval(recordsAnchorDate, recordsTimeframe, weekStartsOn),
    [recordsAnchorDate, recordsTimeframe, weekStartsOn],
  )

  const recordsTransactions = useMemo(
    () =>
      [...getTransactionsInPeriod({
        transactions,
        anchorDate: recordsAnchorDate,
        timeframe: recordsTimeframe,
        weekStartsOn,
      })].sort(sortTransactionsNewestFirst),
    [recordsAnchorDate, recordsTimeframe, transactions, weekStartsOn],
  )

  const filteredRecordTransactions = useMemo(
    () =>
      recordsTransactions.filter((transaction) => {
        if (
          transactionTypeFilter !== 'all' &&
          transaction.type !== transactionTypeFilter
        ) {
          return false
        }

        if (
          transactionCategoryFilter !== 'all' &&
          transaction.categoryId !== transactionCategoryFilter
        ) {
          return false
        }

        return true
      }),
    [recordsTransactions, transactionCategoryFilter, transactionTypeFilter],
  )

  const recordsSummary = useMemo(
    () =>
      getPeriodSummary({
        transactions,
        budgetRules,
        anchorDate: recordsAnchorDate,
        timeframe: recordsTimeframe,
        weekStartsOn,
      }),
    [budgetRules, recordsAnchorDate, recordsTimeframe, transactions, weekStartsOn],
  )

  const overviewTotals = useMemo(
    () =>
      getOverviewTotals({
        transactions,
        budgetRules,
        referenceDate: currentDateValue,
        weekStartsOn,
      }),
    [budgetRules, currentDateValue, transactions, weekStartsOn],
  )

  const overviewRows = useMemo(
    () =>
      getOverviewSummaryRows({
        categories,
        transactions,
        budgetRules,
        referenceDate: currentDateValue,
        weekStartsOn,
      }),
    [budgetRules, categories, currentDateValue, transactions, weekStartsOn],
  )

  const monthlyCategoryRows = useMemo(
    () =>
      getCategorySummaryRows({
        categories,
        transactions,
        budgetRules,
        anchorDate: currentDateValue,
        timeframe: 'monthly',
        weekStartsOn,
      }).filter((row) => row.spend > 0 || row.hasBudget),
    [budgetRules, categories, currentDateValue, transactions, weekStartsOn],
  )

  const trendSeries = useMemo(
    () =>
      getRollingTrendSeries({
        transactions,
        budgetRules,
        timeframe: overviewTrendTimeframe,
        anchorDate: currentDateValue,
        weekStartsOn,
      }),
    [
      budgetRules,
      currentDateValue,
      overviewTrendTimeframe,
      transactions,
      weekStartsOn,
    ],
  )

  const budgetMatrixRows = useMemo(() => {
    const targets = [
      { id: 'overall', label: 'Overall budget', scope: 'total' as const },
      ...activeExpenseCategories.map((category) => ({
        id: category.id,
        label: category.name,
        scope: 'category' as const,
      })),
    ]

    return targets.map((target) => ({
      id: target.id,
      label: target.label,
      daily: getBudgetSnapshot({
        budgetRules,
        scope: target.scope,
        categoryId: target.scope === 'category' ? target.id : undefined,
        timeframe: 'daily',
        referenceDate: currentTimestamp,
      }),
      weekly: getBudgetSnapshot({
        budgetRules,
        scope: target.scope,
        categoryId: target.scope === 'category' ? target.id : undefined,
        timeframe: 'weekly',
        referenceDate: currentTimestamp,
      }),
      monthly: getBudgetSnapshot({
        budgetRules,
        scope: target.scope,
        categoryId: target.scope === 'category' ? target.id : undefined,
        timeframe: 'monthly',
        referenceDate: currentTimestamp,
      }),
    }))
  }, [activeExpenseCategories, budgetRules, currentTimestamp])

  const categoryCountsByKind = useMemo(
    () =>
      categories.reduce<Record<CategoryKind, number>>(
        (counts, category) => {
          if (!category.archived) {
            counts[category.kind] += 1
          }

          return counts
        },
        { expense: 0, income: 0 },
      ),
    [categories],
  )

  const overviewOverallRow = useMemo<OverviewSummaryRow>(
    () => ({
      categoryId: 'overall',
      categoryName: 'Overall',
      archived: false,
      dailyBudget: overviewTotals.daily.budget,
      dailySpent: overviewTotals.daily.spend,
      dailyRemaining: overviewTotals.daily.remaining,
      dailyHasBudget: overviewTotals.daily.hasBudget,
      weeklyBudget: overviewTotals.weekly.budget,
      weeklySpent: overviewTotals.weekly.spend,
      weeklyRemaining: overviewTotals.weekly.remaining,
      weeklyHasBudget: overviewTotals.weekly.hasBudget,
      monthlyBudget: overviewTotals.monthly.budget,
      monthlySpent: overviewTotals.monthly.spend,
      monthlyRemaining: overviewTotals.monthly.remaining,
      monthlyHasBudget: overviewTotals.monthly.hasBudget,
      monthlyPercentUsed:
        overviewTotals.monthly.budget > 0
          ? (overviewTotals.monthly.spend / overviewTotals.monthly.budget) * 100
          : 0,
    }),
    [overviewTotals],
  )

  const trendIsEmpty = trendSeries.every(
    (point) => point.spend === 0 && point.budget === 0 && point.income === 0,
  )

  const activeTabMeta = tabItems.find((tab) => tab.id === activeTab) ?? tabItems[0]

  useEffect(() => {
    setCategoryDrafts((currentDrafts) =>
      Object.fromEntries(
        categories.map((category) => [
          category.id,
          currentDrafts[category.id] ?? category.name,
        ]),
      ),
    )
  }, [categories])

  const handleTransactionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(resolvedTransactionForm.amount)

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !resolvedTransactionForm.categoryId
    ) {
      return
    }

    const nextTransaction: Transaction = {
      id: editingTransactionId ?? createTransactionId(),
      type: resolvedTransactionForm.type,
      categoryId: resolvedTransactionForm.categoryId,
      amount,
      occurredAt: resolvedTransactionForm.occurredAt,
      note: resolvedTransactionForm.note.trim(),
    }

    try {
      if (editingTransactionId) {
        await onUpdateTransaction(nextTransaction)
        setTransactionNotice('Transaction updated.')
      } else {
        await onCreateTransaction(nextTransaction)
        setTransactionNotice('Transaction saved.')
      }

      setEditingTransactionId(null)
      setTransactionForm(createTransactionFormState(categories))
    } catch (error) {
      setTransactionNotice(getErrorMessage(error))
    }
  }

  const handleBudgetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(resolvedBudgetForm.amount)

    if (!Number.isFinite(amount) || amount < 0) {
      return
    }

    const effectiveFrom = getNow().toISOString()
    const nextBudgetRule: BudgetRule = {
      id: createBudgetRuleId(),
      scope: resolvedBudgetForm.scope,
      categoryId:
        resolvedBudgetForm.scope === 'category'
          ? resolvedBudgetForm.categoryId
          : undefined,
      timeframe: resolvedBudgetForm.timeframe,
      amount,
      effectiveFrom,
    }

    try {
      await onCreateBudgetRule(nextBudgetRule)
      setBudgetNotice(
        `Updated ${resolvedBudgetForm.scope === 'total' ? 'overall' : getCategoryName(categories, resolvedBudgetForm.categoryId)} ${resolvedBudgetForm.timeframe} budget immediately.`,
      )
      setBudgetForm((currentForm) => ({ ...currentForm, amount: '' }))
    } catch (error) {
      setBudgetNotice(getErrorMessage(error))
    }
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financial Tracker</p>
          <h1>{activeTabMeta.label}</h1>
        </div>
        <div className="page-header-actions">
          <div className="user-chip">
            <strong>{user.displayName || user.email || 'Signed-in user'}</strong>
            <span>Cloud sync enabled</span>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={async () => {
              try {
                setSignOutBusy(true)
                setHeaderMessage('')
                await onSignOut()
              } catch (error) {
                setHeaderMessage(getErrorMessage(error))
              } finally {
                setSignOutBusy(false)
              }
            }}
          >
            {signOutBusy ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
        <p className="page-description">{activeTabMeta.description}</p>
      </header>

      {headerMessage ? <p className="notice">{headerMessage}</p> : null}

      {activeTab === 'input' ? (
        <main className="tab-page">
          <Panel
            eyebrow="Transactions"
            title={editingTransactionId ? 'Edit transaction' : 'Add transaction'}
            description="Use this page as the clean entry point for expenses and income."
          >
            <TransactionEditor
              editing={editingTransactionId !== null}
              form={resolvedTransactionForm}
              categoryOptions={transactionCategoryOptions}
              onFormChange={(nextForm) => {
                setTransactionNotice('')
                setTransactionForm(nextForm)
              }}
              onSubmit={handleTransactionSubmit}
              onCancel={() => {
                setEditingTransactionId(null)
                setTransactionNotice('')
                setTransactionForm(createTransactionFormState(categories))
              }}
            />
            {transactionNotice ? <p className="notice">{transactionNotice}</p> : null}
          </Panel>

          <Panel
            eyebrow="Recent"
            title="Latest entries"
            description="A quick glance at the newest items you have saved."
          >
            <div className="quick-list">
              {[...transactions]
                .sort(sortTransactionsNewestFirst)
                .slice(0, 6)
                .map((transaction) => (
                  <article className="quick-list-row" key={transaction.id}>
                    <div>
                      <strong>{getCategoryName(categories, transaction.categoryId)}</strong>
                      <p>{transaction.note || 'No note'}</p>
                    </div>
                    <span
                      className={transaction.type === 'income' ? 'positive' : 'negative'}
                    >
                      {transaction.type === 'income'
                        ? formatSignedCurrency(transaction.amount, currency)
                        : formatSignedCurrency(-transaction.amount, currency)}
                    </span>
                  </article>
                ))}
              {transactions.length === 0 ? (
                <div className="empty-state small">
                  <h3>No transactions yet</h3>
                  <p>Start by saving your first income or expense entry.</p>
                </div>
              ) : null}
            </div>
          </Panel>
        </main>
      ) : null}

      {activeTab === 'manage' ? (
        <main className="tab-page">
          <Panel
            eyebrow="Categories"
            title="Categories & budgets"
            description="Manage expense and income categories separately from your records and dashboard."
          >
            <CategoryManager
              categories={categories}
              categoryForm={categoryForm}
              categoryDrafts={categoryDrafts}
              activeCounts={categoryCountsByKind}
              onCategoryFormChange={(nextForm) => {
                setCategoryNotice('')
                setCategoryForm(nextForm)
              }}
              onSubmit={async (event) => {
                event.preventDefault()
                const name = categoryForm.name.trim()

                if (!name) {
                  return
                }

                const nextCategoryId = createCategoryId()

                try {
                  await onCreateCategory({
                    id: nextCategoryId,
                    name,
                    kind: categoryForm.kind,
                    archived: false,
                  })
                  setCategoryDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [nextCategoryId]: name,
                  }))
                  setCategoryForm((currentForm) => ({ ...currentForm, name: '' }))
                  setCategoryNotice('Category added.')
                } catch (error) {
                  setCategoryNotice(getErrorMessage(error))
                }
              }}
              onDraftChange={(categoryId, value) =>
                setCategoryDrafts((currentDrafts) => ({
                  ...currentDrafts,
                  [categoryId]: value,
                }))
              }
              onRename={async (categoryId) => {
                const category = categories.find((entry) => entry.id === categoryId)
                const nextName = categoryDrafts[categoryId]?.trim()

                if (!category || !nextName) {
                  return
                }

                try {
                  await onUpdateCategory({ ...category, name: nextName })
                  setCategoryNotice('Category updated.')
                } catch (error) {
                  setCategoryNotice(getErrorMessage(error))
                }
              }}
              onArchive={async (categoryId) => {
                const category = categories.find((entry) => entry.id === categoryId)

                if (!category || categoryCountsByKind[category.kind] <= 1) {
                  return
                }

                try {
                  await onUpdateCategory({ ...category, archived: true })
                  setCategoryNotice('Category archived.')
                } catch (error) {
                  setCategoryNotice(getErrorMessage(error))
                }
              }}
              onRestore={async (categoryId) => {
                const category = categories.find((entry) => entry.id === categoryId)

                if (!category) {
                  return
                }

                try {
                  await onUpdateCategory({ ...category, archived: false })
                  setCategoryNotice('Category restored.')
                } catch (error) {
                  setCategoryNotice(getErrorMessage(error))
                }
              }}
            />
            {categoryNotice ? <p className="notice">{categoryNotice}</p> : null}
          </Panel>

          <Panel
            eyebrow="Budgets"
            title="Change budgets instantly"
            description="Budget edits apply to the current day, week, or month right away."
          >
            <BudgetManager
              form={resolvedBudgetForm}
              activeExpenseCategories={activeExpenseCategories}
              budgetAppliedAt={currentTimestamp}
              budgetNotice={budgetNotice}
              budgetMatrixRows={budgetMatrixRows}
              currency={currency}
              onFormChange={(nextForm) => {
                setBudgetNotice('')
                setBudgetForm(nextForm)
              }}
              onSubmit={handleBudgetSubmit}
            />
          </Panel>
        </main>
      ) : null}

      {activeTab === 'records' ? (
        <main className="tab-page">
          <section className="toolbar-card">
            <div className="toolbar-row">
              <div className="segmented-control" role="tablist" aria-label="Record timeframe">
                {timeframeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`timeframe-button ${
                      recordsTimeframe === option.value ? 'active' : ''
                    }`}
                    onClick={() => setRecordsTimeframe(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="period-navigation compact">
                <button
                  type="button"
                  className="nav-button"
                  onClick={() =>
                    setRecordsAnchorDate((current) =>
                      shiftAnchorDate(current, recordsTimeframe, -1),
                    )
                  }
                >
                  Previous
                </button>
                <div className="period-badge compact">
                  <span className="period-caption">Selected period</span>
                  <strong data-testid="records-period-label">{recordsPeriod.label}</strong>
                </div>
                <button
                  type="button"
                  className="nav-button"
                  onClick={() =>
                    setRecordsAnchorDate((current) =>
                      shiftAnchorDate(current, recordsTimeframe, 1),
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <section className="summary-grid compact-grid">
            <SummaryCard
              label="Spent"
              value={formatCurrency(recordsSummary.spend, currency)}
              helpText={`Expenses in this ${recordsTimeframeLabels[recordsTimeframe]} view.`}
            />
            <SummaryCard
              label="Budget"
              value={getSummaryValue(
                recordsSummary.hasBudget ? recordsSummary.budget : null,
                currency,
              )}
              helpText="Uses the last budget active in this period."
            />
            <SummaryCard
              label="Remaining"
              value={getSummaryValue(recordsSummary.remaining, currency, true)}
              helpText="Positive means quota left. Negative means overspending."
              tone={getRemainingTone(recordsSummary.remaining)}
            />
          </section>

          <Panel
            eyebrow="Records"
            title="Transaction records"
            description="Filter by period, category, or type, then jump into edit mode from here."
          >
            <TransactionsTable
              categories={categories}
              transactions={filteredRecordTransactions}
              transactionTypeFilter={transactionTypeFilter}
              transactionCategoryFilter={transactionCategoryFilter}
              currency={currency}
              onTypeFilterChange={setTransactionTypeFilter}
              onCategoryFilterChange={setTransactionCategoryFilter}
              onEdit={(transaction) => {
                setEditingTransactionId(transaction.id)
                setTransactionNotice('')
                setTransactionForm({
                  type: transaction.type,
                  categoryId: transaction.categoryId,
                  amount: `${transaction.amount}`,
                  occurredAt: transaction.occurredAt,
                  note: transaction.note ?? '',
                })
                setActiveTab('input')
              }}
              onDelete={async (transactionId) => {
                try {
                  await onDeleteTransaction(transactionId)

                  if (editingTransactionId === transactionId) {
                    setEditingTransactionId(null)
                    setTransactionForm(createTransactionFormState(categories))
                  }
                } catch (error) {
                  setHeaderMessage(getErrorMessage(error))
                }
              }}
            />
          </Panel>
        </main>
      ) : null}

      {activeTab === 'overview' ? (
        <main className="tab-page">
          <section className="summary-grid">
            <SummaryCard
              label="Spent This Month"
              value={formatCurrency(overviewTotals.monthly.spend, currency)}
              helpText="Overall expense total for the current month."
              testId="summary-spend"
            />
            <SummaryCard
              label="Monthly Budget"
              value={getSummaryValue(
                overviewTotals.monthly.hasBudget ? overviewTotals.monthly.budget : null,
                currency,
              )}
              helpText="Latest monthly overall budget active this month."
              testId="summary-budget"
            />
            <SummaryCard
              label="Monthly Remaining"
              value={getSummaryValue(overviewTotals.monthly.remaining, currency, true)}
              helpText="How much monthly quota is left right now."
              tone={getRemainingTone(overviewTotals.monthly.remaining)}
              testId="summary-remaining"
            />
            <SummaryCard
              label="Income This Month"
              value={formatCurrency(overviewTotals.monthly.income, currency)}
              helpText="Income is tracked separately from budget usage."
              tone="positive"
              testId="summary-income"
            />
            <SummaryCard
              label="Net Cash Flow"
              value={formatSignedCurrency(overviewTotals.monthly.net, currency)}
              helpText="Income minus expenses for the current month."
              tone={overviewTotals.monthly.net >= 0 ? 'positive' : 'negative'}
              testId="summary-net"
            />
          </section>

          <Panel
            eyebrow="Overview"
            title="Budget summary"
            description="This table keeps daily, weekly, and monthly category numbers together like a spreadsheet."
          >
            <OverviewSummaryTable
              rows={overviewRows}
              overallRow={overviewOverallRow}
              currency={currency}
            />
          </Panel>

          <Panel
            eyebrow="Charts"
            title="Spend vs budget trend"
            description="One chart per row so each trend is easier to read."
          >
            <div className="chart-toolbar">
              <div className="segmented-control" role="tablist" aria-label="Trend timeframe">
                {timeframeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`timeframe-button ${
                      overviewTrendTimeframe === option.value ? 'active' : ''
                    }`}
                    onClick={() => setOverviewTrendTimeframe(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart data={trendSeries} currency={currency} empty={trendIsEmpty} />
          </Panel>

          <Panel
            eyebrow="Charts"
            title="Monthly category comparison"
            description="Monthly category spending and budgets are separated into their own chart for readability."
          >
            <CategoryBudgetChart data={monthlyCategoryRows} currency={currency} />
          </Panel>
        </main>
      ) : null}

      <BottomNav activeTab={activeTab} items={tabItems} onChange={setActiveTab} />
    </div>
  )
}

export default TrackerShell
