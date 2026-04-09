import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

import './App.css'
import BudgetManager from './components/BudgetManager'
import BudgetSummaryTable from './components/BudgetSummaryTable'
import CategoryBudgetChart from './components/CategoryBudgetChart'
import CategoryManager from './components/CategoryManager'
import Panel from './components/Panel'
import PeriodHeader from './components/PeriodHeader'
import SummaryCard from './components/SummaryCard'
import TransactionEditor from './components/TransactionEditor'
import TransactionsTable from './components/TransactionsTable'
import TrendChart from './components/TrendChart'
import {
  createBudgetRuleId,
  createCategoryId,
  createTransactionId,
} from './lib/defaults'
import {
  formatCurrency,
  formatDisplayDate,
  formatSignedCurrency,
  formatStorageDate,
  getActiveCategories,
  getBudgetSnapshot,
  getCategoryName,
  getCategoryOptions,
  getCategorySummaryRows,
  getNow,
  getNextBudgetEffectiveFrom,
  getPeriodInterval,
  getPeriodSummary,
  getRollingTrendSeries,
  getTransactionsInPeriod,
  parseDateValue,
  shiftAnchorDate,
} from './lib/finance'
import type {
  AppState,
  BudgetRule,
  BudgetScope,
  Category,
  CategoryKind,
  Timeframe,
  Transaction,
  TransactionType,
} from './lib/finance'
import { loadAppState, saveAppState } from './lib/storage'

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

const getSummaryValue = (value: number | null, currency: string, signed = false) => {
  if (value === null) {
    return 'No budget'
  }

  return signed ? formatSignedCurrency(value, currency) : formatCurrency(value, currency)
}

const getStatusLabel = (remaining: number | null, hasBudget: boolean) => {
  if (!hasBudget || remaining === null) {
    return 'No budget'
  }

  if (remaining === 0) {
    return 'On target'
  }

  return remaining > 0 ? 'Under budget' : 'Over budget'
}

function App() {
  const initialState = useMemo(() => loadAppState(), [])
  const [appState, setAppState] = useState<AppState>(initialState)
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('weekly')
  const [anchorDate, setAnchorDate] = useState(() => formatStorageDate(getNow()))
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(
    null,
  )
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(() =>
    createTransactionFormState(initialState.categories),
  )
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    'all' | TransactionType
  >('all')
  const [transactionCategoryFilter, setTransactionCategoryFilter] =
    useState<string>('all')
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(() =>
    createBudgetFormState(initialState.categories),
  )
  const [budgetNotice, setBudgetNotice] = useState('')
  const [categoryForm, setCategoryForm] = useState<{
    name: string
    kind: CategoryKind
  }>({ name: '', kind: 'expense' })
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialState.categories.map((category) => [category.id, category.name]),
    ),
  )

  const { transactions, categories, budgetRules, preferences } = appState
  const currency = preferences.currency
  const weekStartsOn = preferences.weekStartsOn

  useEffect(() => {
    saveAppState(appState)
  }, [appState])

  const selectedPeriod = useMemo(
    () => getPeriodInterval(anchorDate, selectedTimeframe, weekStartsOn),
    [anchorDate, selectedTimeframe, weekStartsOn],
  )

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

  const selectedPeriodTransactions = useMemo(
    () =>
      [...getTransactionsInPeriod({
        transactions,
        anchorDate,
        timeframe: selectedTimeframe,
        weekStartsOn,
      })].sort(sortTransactionsNewestFirst),
    [anchorDate, selectedTimeframe, transactions, weekStartsOn],
  )

  const filteredTransactions = useMemo(
    () =>
      selectedPeriodTransactions.filter((transaction) => {
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
    [selectedPeriodTransactions, transactionCategoryFilter, transactionTypeFilter],
  )

  const selectedPeriodSummary = useMemo(
    () =>
      getPeriodSummary({
        transactions,
        budgetRules,
        anchorDate,
        timeframe: selectedTimeframe,
        weekStartsOn,
      }),
    [anchorDate, budgetRules, selectedTimeframe, transactions, weekStartsOn],
  )

  const categorySummaryRows = useMemo(
    () =>
      getCategorySummaryRows({
        categories,
        transactions,
        budgetRules,
        anchorDate,
        timeframe: selectedTimeframe,
        weekStartsOn,
      }),
    [
      anchorDate,
      budgetRules,
      categories,
      selectedTimeframe,
      transactions,
      weekStartsOn,
    ],
  )

  const trendSeries = useMemo(
    () =>
      getRollingTrendSeries({
        transactions,
        budgetRules,
        timeframe: selectedTimeframe,
        anchorDate,
        weekStartsOn,
      }),
    [anchorDate, budgetRules, selectedTimeframe, transactions, weekStartsOn],
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
        referenceDate: getNow(),
        weekStartsOn,
      }),
      weekly: getBudgetSnapshot({
        budgetRules,
        scope: target.scope,
        categoryId: target.scope === 'category' ? target.id : undefined,
        timeframe: 'weekly',
        referenceDate: getNow(),
        weekStartsOn,
      }),
      monthly: getBudgetSnapshot({
        budgetRules,
        scope: target.scope,
        categoryId: target.scope === 'category' ? target.id : undefined,
        timeframe: 'monthly',
        referenceDate: getNow(),
        weekStartsOn,
      }),
    }))
  }, [activeExpenseCategories, budgetRules, weekStartsOn])

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

  const budgetSummaryRows = [
    {
      categoryId: 'total',
      categoryName: 'Overall',
      budget: selectedPeriodSummary.budget,
      hasBudget: selectedPeriodSummary.hasBudget,
      spend: selectedPeriodSummary.spend,
      remaining: selectedPeriodSummary.remaining,
      status: getStatusLabel(
        selectedPeriodSummary.remaining,
        selectedPeriodSummary.hasBudget,
      ),
    },
    ...categorySummaryRows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      budget: row.budget,
      hasBudget: row.hasBudget,
      spend: row.spend,
      remaining: row.remaining,
      status: getStatusLabel(row.remaining, row.hasBudget),
    })),
  ]

  const categoryChartRows = categorySummaryRows.filter(
    (row) => row.spend > 0 || row.hasBudget,
  )
  const trendIsEmpty = trendSeries.every(
    (point) => point.spend === 0 && point.budget === 0 && point.income === 0,
  )
  const budgetEffectiveFrom = getNextBudgetEffectiveFrom(
    getNow(),
    budgetForm.timeframe,
    weekStartsOn,
  )

  const handleTransactionSubmit = (event: FormEvent<HTMLFormElement>) => {
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

    setAppState((currentState) => ({
      ...currentState,
      transactions: editingTransactionId
        ? currentState.transactions.map((transaction) =>
            transaction.id === editingTransactionId ? nextTransaction : transaction,
          )
        : [nextTransaction, ...currentState.transactions],
    }))
    setEditingTransactionId(null)
    setTransactionForm(createTransactionFormState(categories))
  }

  const handleBudgetSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(resolvedBudgetForm.amount)

    if (!Number.isFinite(amount) || amount < 0) {
      return
    }

    const effectiveFrom = getNextBudgetEffectiveFrom(
      getNow(),
      budgetForm.timeframe,
      weekStartsOn,
    )
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

    setAppState((currentState) => ({
      ...currentState,
      budgetRules: [
        ...currentState.budgetRules.filter(
          (rule) =>
            !(
              rule.scope === nextBudgetRule.scope &&
              rule.timeframe === nextBudgetRule.timeframe &&
              rule.categoryId === nextBudgetRule.categoryId &&
              rule.effectiveFrom === nextBudgetRule.effectiveFrom
            ),
        ),
        nextBudgetRule,
      ],
    }))
    setBudgetNotice(
      `Scheduled ${resolvedBudgetForm.scope === 'total' ? 'overall' : getCategoryName(categories, resolvedBudgetForm.categoryId)} budget from ${formatDisplayDate(effectiveFrom)}.`,
    )
    setBudgetForm((currentForm) => ({ ...currentForm, amount: '' }))
  }

  return (
    <div className="app-shell">
      <PeriodHeader
        selectedTimeframe={selectedTimeframe}
        periodLabel={selectedPeriod.label}
        onTimeframeChange={setSelectedTimeframe}
        onShiftPeriod={(amount) =>
          setAnchorDate((current) => shiftAnchorDate(current, selectedTimeframe, amount))
        }
      />

      <section className="summary-grid">
        <SummaryCard
          label="Spent"
          value={formatCurrency(selectedPeriodSummary.spend, currency)}
          helpText="Total expenses inside the selected timeframe."
          testId="summary-spend"
        />
        <SummaryCard
          label="Budget"
          value={getSummaryValue(
            selectedPeriodSummary.hasBudget ? selectedPeriodSummary.budget : null,
            currency,
          )}
          helpText="Applies the total budget active at the start of the period."
          testId="summary-budget"
        />
        <SummaryCard
          label="Remaining"
          value={getSummaryValue(selectedPeriodSummary.remaining, currency, true)}
          helpText="Positive means quota left. Negative means overspending."
          tone={getRemainingTone(selectedPeriodSummary.remaining)}
          testId="summary-remaining"
        />
        <SummaryCard
          label="Income"
          value={formatCurrency(selectedPeriodSummary.income, currency)}
          helpText="Income is tracked separately and does not affect budget usage."
          tone="positive"
          testId="summary-income"
        />
        <SummaryCard
          label="Net cash flow"
          value={formatSignedCurrency(selectedPeriodSummary.net, currency)}
          helpText="Income minus expenses in the selected period."
          tone={selectedPeriodSummary.net >= 0 ? 'positive' : 'negative'}
          testId="summary-net"
        />
      </section>

      <main className="content-grid">
        <div className="stack">
          <Panel
            eyebrow="Transactions"
            title={editingTransactionId ? 'Edit transaction' : 'Add transaction'}
            description="Capture every income or expense with a category, date, and short note."
          >
            <TransactionEditor
              editing={editingTransactionId !== null}
              form={resolvedTransactionForm}
              categoryOptions={transactionCategoryOptions}
              onFormChange={setTransactionForm}
              onSubmit={handleTransactionSubmit}
              onCancel={() => {
                setEditingTransactionId(null)
                setTransactionForm(createTransactionFormState(categories))
              }}
            />
          </Panel>

          <Panel
            eyebrow="Categories"
            title="Manage categories"
            description="Keep your expense and income buckets flexible without losing historical data."
          >
            <CategoryManager
              categories={categories}
              categoryForm={categoryForm}
              categoryDrafts={categoryDrafts}
              activeCounts={categoryCountsByKind}
              onCategoryFormChange={setCategoryForm}
              onSubmit={(event) => {
                event.preventDefault()
                const name = categoryForm.name.trim()

                if (!name) {
                  return
                }

                const nextCategoryId = createCategoryId()
                setAppState((currentState) => ({
                  ...currentState,
                  categories: [
                    ...currentState.categories,
                    {
                      id: nextCategoryId,
                      name,
                      kind: categoryForm.kind,
                      archived: false,
                    },
                  ],
                }))
                setCategoryDrafts((currentDrafts) => ({
                  ...currentDrafts,
                  [nextCategoryId]: name,
                }))
                setCategoryForm((currentForm) => ({ ...currentForm, name: '' }))
              }}
              onDraftChange={(categoryId, value) =>
                setCategoryDrafts((currentDrafts) => ({
                  ...currentDrafts,
                  [categoryId]: value,
                }))
              }
              onRename={(categoryId) => {
                const nextName = categoryDrafts[categoryId]?.trim()

                if (!nextName) {
                  return
                }

                setAppState((currentState) => ({
                  ...currentState,
                  categories: currentState.categories.map((category) =>
                    category.id === categoryId
                      ? { ...category, name: nextName }
                      : category,
                  ),
                }))
                setCategoryDrafts((currentDrafts) => ({
                  ...currentDrafts,
                  [categoryId]: nextName,
                }))
              }}
              onArchive={(categoryId) => {
                const category = categories.find((entry) => entry.id === categoryId)

                if (!category || categoryCountsByKind[category.kind] <= 1) {
                  return
                }

                setAppState((currentState) => ({
                  ...currentState,
                  categories: currentState.categories.map((entry) =>
                    entry.id === categoryId ? { ...entry, archived: true } : entry,
                  ),
                }))
              }}
              onRestore={(categoryId) =>
                setAppState((currentState) => ({
                  ...currentState,
                  categories: currentState.categories.map((category) =>
                    category.id === categoryId
                      ? { ...category, archived: false }
                      : category,
                  ),
                }))
              }
            />
          </Panel>

          <Panel
            eyebrow="Budgets"
            title="Schedule budget rules"
            description="Budget changes are versioned and only take effect on the next matching period boundary."
          >
            <BudgetManager
              form={resolvedBudgetForm}
              activeExpenseCategories={activeExpenseCategories}
              budgetEffectiveFrom={budgetEffectiveFrom}
              budgetNotice={budgetNotice}
              budgetMatrixRows={budgetMatrixRows}
              currency={currency}
              onFormChange={setBudgetForm}
              onSubmit={handleBudgetSubmit}
            />
          </Panel>
        </div>

        <div className="stack">
          <Panel
            eyebrow="Charts"
            title="Spend vs budget trend"
            description="Rolling history for the currently selected timeframe."
          >
            <TrendChart data={trendSeries} currency={currency} empty={trendIsEmpty} />
          </Panel>

          <Panel
            eyebrow="Charts"
            title="Category budget comparison"
            description="Compare spend and budget for the selected period."
          >
            <CategoryBudgetChart data={categoryChartRows} currency={currency} />
          </Panel>
        </div>
      </main>

      <section className="table-grid">
        <Panel
          eyebrow="Table"
          title="Budget summary table"
          description="Remaining values are shown as positive when under budget and negative when over."
        >
          <BudgetSummaryTable rows={budgetSummaryRows} currency={currency} />
        </Panel>

        <Panel
          eyebrow="Table"
          title="Transactions in selected period"
          description="Filter the current period and edit or remove entries directly from the table."
        >
          <TransactionsTable
            categories={categories}
            transactions={filteredTransactions}
            transactionTypeFilter={transactionTypeFilter}
            transactionCategoryFilter={transactionCategoryFilter}
            currency={currency}
            onTypeFilterChange={setTransactionTypeFilter}
            onCategoryFilterChange={setTransactionCategoryFilter}
            onEdit={(transaction) => {
              setEditingTransactionId(transaction.id)
              setTransactionForm({
                type: transaction.type,
                categoryId: transaction.categoryId,
                amount: `${transaction.amount}`,
                occurredAt: transaction.occurredAt,
                note: transaction.note ?? '',
              })
            }}
            onDelete={(transactionId) => {
              setAppState((currentState) => ({
                ...currentState,
                transactions: currentState.transactions.filter(
                  (transaction) => transaction.id !== transactionId,
                ),
              }))

              if (editingTransactionId === transactionId) {
                setEditingTransactionId(null)
                setTransactionForm(createTransactionFormState(categories))
              }
            }}
          />
        </Panel>
      </section>
    </div>
  )
}

export default App
