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

  it('uses bottom tabs and supports create, edit, and delete through input and records pages', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Input' }))

    const inputPanel = screen
      .getByRole('heading', { name: 'Add transaction' })
      .closest('section')
    expect(inputPanel).not.toBeNull()

    const inputScope = within(inputPanel as HTMLElement)
    await user.clear(inputScope.getByLabelText('Amount'))
    await user.type(inputScope.getByLabelText('Amount'), '120')
    await user.type(inputScope.getByLabelText('Note / description'), 'Lunch')
    await user.click(inputScope.getByRole('button', { name: 'Save transaction' }))

    await user.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$120.00')

    await user.click(screen.getByRole('button', { name: 'Records' }))
    expect(screen.getByTestId('transactions-table')).toHaveTextContent('Lunch')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { name: 'Edit transaction' })).toBeInTheDocument()

    const editPanel = screen
      .getByRole('heading', { name: 'Edit transaction' })
      .closest('section')
    expect(editPanel).not.toBeNull()
    const editScope = within(editPanel as HTMLElement)

    await user.clear(editScope.getByLabelText('Amount'))
    await user.type(editScope.getByLabelText('Amount'), '150')
    await user.click(editScope.getByRole('button', { name: 'Update transaction' }))

    await user.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$150.00')

    await user.click(screen.getByRole('button', { name: 'Records' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await user.click(screen.getByRole('button', { name: 'Overview' }))
    expect(screen.getByTestId('summary-spend')).toHaveTextContent('HK$0.00')
  })

  it('supports category creation, rename, and archive on the manage tab', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Manage' }))

    const managePanel = screen
      .getByRole('heading', { name: 'Categories & budgets' })
      .closest('section')
    expect(managePanel).not.toBeNull()

    const manageScope = within(managePanel as HTMLElement)
    await user.type(manageScope.getByLabelText('Name'), 'Pets')
    await user.click(manageScope.getByRole('button', { name: 'Add category' }))

    const petInput = manageScope.getByDisplayValue('Pets')
    expect(petInput).toBeInTheDocument()

    await user.clear(petInput)
    await user.type(petInput, 'Pet Care')
    const petRow = petInput.closest('article')
    expect(petRow).not.toBeNull()

    const petScope = within(petRow as HTMLElement)
    await user.click(petScope.getByRole('button', { name: 'Save' }))
    expect(manageScope.getByDisplayValue('Pet Care')).toBeInTheDocument()

    await user.click(petScope.getByRole('button', { name: 'Archive' }))
    expect(petScope.getByText('Archived')).toBeInTheDocument()
  })

  it('applies budget changes immediately and renders the overview table plus separated charts', async () => {
    const user = userEvent.setup()

    setStoredState({
      transactions: [
        {
          id: 'expense-april',
          type: 'expense',
          categoryId: 'expense-food',
          amount: 120,
          occurredAt: '2026-04-10',
          note: 'Groceries',
        },
        {
          id: 'income-april',
          type: 'income',
          categoryId: 'income-salary',
          amount: 1000,
          occurredAt: '2026-04-10',
          note: 'Salary',
        },
      ],
    })

    render(<App />)

    expect(screen.getByTestId('summary-budget')).toHaveTextContent('No budget')

    await user.click(screen.getByRole('button', { name: 'Manage' }))

    const budgetPanel = screen
      .getByRole('heading', { name: 'Change budgets instantly' })
      .closest('section')
    expect(budgetPanel).not.toBeNull()

    const budgetScope = within(budgetPanel as HTMLElement)
    await user.selectOptions(budgetScope.getByLabelText('Timeframe'), 'monthly')
    await user.clear(budgetScope.getByLabelText('Amount'))
    await user.type(budgetScope.getByLabelText('Amount'), '900')
    await user.click(budgetScope.getByRole('button', { name: 'Save budget change' }))

    await user.click(screen.getByRole('button', { name: 'Overview' }))

    expect(screen.getByTestId('summary-budget')).toHaveTextContent('HK$900.00')
    expect(screen.getByTestId('summary-remaining')).toHaveTextContent('+HK$780.00')
    expect(screen.getByTestId('summary-income')).toHaveTextContent('HK$1,000.00')
    expect(screen.getByTestId('overview-summary-table')).toBeInTheDocument()
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('category-chart')).toBeInTheDocument()
    expect(screen.getByTestId('overview-summary-table')).toHaveTextContent(
      'Daily Budget (A)',
    )
  })
})
