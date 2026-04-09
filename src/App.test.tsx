import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { createDefaultCategories, STORAGE_KEY } from './lib/defaults'
import * as financeModule from './lib/finance'
import type { AppState } from './lib/finance'

const setStoredState = (partialState?: Partial<AppState>) => {
  const state: AppState = {
    transactions: [],
    categories: createDefaultCategories(),
    budgetRules: [],
    preferences: {
      currency: 'HKD',
      weekStartsOn: 1,
    },
    ...partialState,
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(financeModule, 'getNow').mockReturnValue(
      new Date('2026-04-10T09:00:00.000Z'),
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('supports transaction create, update, and delete flows', async () => {
    const user = userEvent.setup()

    render(<App />)

    const transactionPanel = screen
      .getByRole('heading', { name: 'Add transaction' })
      .closest('section')

    expect(transactionPanel).not.toBeNull()

    const transactionScope = within(transactionPanel as HTMLElement)
    await user.clear(transactionScope.getByLabelText('Amount'))
    await user.type(transactionScope.getByLabelText('Amount'), '120')
    await user.type(transactionScope.getByLabelText('Note / description'), 'Lunch')
    await user.click(transactionScope.getByRole('button', { name: 'Save transaction' }))

    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$120.00')
    expect(screen.getByTestId('transactions-table')).toHaveTextContent('Lunch')

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const editPanel = screen
      .getByRole('heading', { name: 'Edit transaction' })
      .closest('section')
    expect(editPanel).not.toBeNull()

    const editScope = within(editPanel as HTMLElement)
    await user.clear(editScope.getByLabelText('Amount'))
    await user.type(editScope.getByLabelText('Amount'), '150')
    await user.click(editScope.getByRole('button', { name: 'Update transaction' }))

    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$150.00')

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$0.00')
    expect(screen.getByTestId('transactions-table')).not.toHaveTextContent('Lunch')
  })

  it('supports category creation, rename, and archive flows', async () => {
    const user = userEvent.setup()

    render(<App />)

    const categoryPanel = screen
      .getByRole('heading', { name: 'Manage categories' })
      .closest('section')
    expect(categoryPanel).not.toBeNull()

    const categoryScope = within(categoryPanel as HTMLElement)
    await user.type(categoryScope.getByLabelText('Name'), 'Pets')
    await user.click(categoryScope.getByRole('button', { name: 'Add category' }))

    const petInput = categoryScope.getByDisplayValue('Pets')
    expect(petInput).toBeInTheDocument()

    await user.clear(petInput)
    await user.type(petInput, 'Pet Care')
    const petRow = petInput.closest('article')
    expect(petRow).not.toBeNull()

    const petScope = within(petRow as HTMLElement)
    await user.click(petScope.getByRole('button', { name: 'Save' }))
    expect(categoryScope.getByDisplayValue('Pet Care')).toBeInTheDocument()

    await user.click(petScope.getByRole('button', { name: 'Archive' }))
    expect(petScope.getByText('Archived')).toBeInTheDocument()
  })

  it('updates cards and tables when switching timeframe and keeps income separate from budget usage', async () => {
    const user = userEvent.setup()

    setStoredState({
      transactions: [
        {
          id: 'expense-april',
          type: 'expense',
          categoryId: 'expense-dining',
          amount: 120,
          occurredAt: '2026-04-10',
          note: 'Lunch',
        },
        {
          id: 'income-april',
          type: 'income',
          categoryId: 'income-salary',
          amount: 1000,
          occurredAt: '2026-04-10',
          note: 'Salary',
        },
        {
          id: 'expense-march',
          type: 'expense',
          categoryId: 'expense-travel',
          amount: 80,
          occurredAt: '2026-03-31',
          note: 'Taxi',
        },
      ],
      budgetRules: [
        {
          id: 'week-budget',
          scope: 'total',
          timeframe: 'weekly',
          amount: 500,
          effectiveFrom: '2026-04-06',
        },
        {
          id: 'month-budget-march',
          scope: 'total',
          timeframe: 'monthly',
          amount: 800,
          effectiveFrom: '2026-03-01',
        },
        {
          id: 'month-budget-april',
          scope: 'total',
          timeframe: 'monthly',
          amount: 900,
          effectiveFrom: '2026-04-01',
        },
      ],
    })

    render(<App />)

    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$120.00')
    expect(screen.getByTestId('summary-budget')).toHaveTextContent('HK$500.00')
    expect(screen.getByTestId('summary-remaining')).toHaveTextContent('+HK$380.00')
    expect(screen.getByTestId('summary-income')).toHaveTextContent('HK$1,000.00')
    expect(screen.getByTestId('summary-net')).toHaveTextContent('+HK$880.00')
    expect(screen.getByTestId('transactions-table')).toHaveTextContent('Lunch')
    expect(screen.getByTestId('transactions-table')).not.toHaveTextContent('Taxi')
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Month' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))

    expect(screen.getByTestId('period-label')).toHaveTextContent('March 2026')
    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$80.00')
    expect(screen.getByTestId('summary-budget')).toHaveTextContent('HK$800.00')
    expect(screen.getByTestId('summary-remaining')).toHaveTextContent('+HK$720.00')
    expect(screen.getByTestId('transactions-table')).toHaveTextContent('Taxi')
    expect(screen.getByTestId('transactions-table')).not.toHaveTextContent('Lunch')
  })
})
