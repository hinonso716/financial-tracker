import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { resetTestBackend, seedTestBackend } from './lib/backend'
import { createDefaultCategories } from './lib/defaults'
import * as financeModule from './lib/finance'
import type { AppState } from './lib/finance'

const USER_PASSWORD = 'password123'

const clickNamedButton = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const buttons = screen.getAllByRole('button', { name })
  await user.click(buttons[buttons.length - 1])
}

const signUpWithEmail = async (
  user: ReturnType<typeof userEvent.setup>,
  {
    email = 'user@example.com',
    password = USER_PASSWORD,
  }: { email?: string; password?: string } = {},
) => {
  await user.click(screen.getAllByRole('button', { name: 'Create account' })[0])
  await user.clear(screen.getByLabelText('Email'))
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), password)
  await clickNamedButton(user, 'Create account')
  await screen.findByTestId('summary-spend')
}

const signInWithEmail = async (
  user: ReturnType<typeof userEvent.setup>,
  {
    email = 'user@example.com',
    password = USER_PASSWORD,
  }: { email?: string; password?: string } = {},
) => {
  await user.click(screen.getAllByRole('button', { name: 'Sign in' })[0])
  await user.clear(screen.getByLabelText('Email'))
  await user.type(screen.getByLabelText('Email'), email)
  await user.clear(screen.getByLabelText('Password'))
  await user.type(screen.getByLabelText('Password'), password)
  await clickNamedButton(user, 'Sign in')
  await screen.findByTestId('summary-spend')
}

const createTransaction = async (
  user: ReturnType<typeof userEvent.setup>,
  {
    amount,
    note,
  }: {
    amount: string
    note: string
  },
) => {
  await user.click(screen.getByRole('button', { name: 'Input' }))
  await user.clear(screen.getByLabelText('Amount'))
  await user.type(screen.getByLabelText('Amount'), amount)
  await user.type(screen.getByLabelText('Note / description'), note)
  await user.click(screen.getByRole('button', { name: 'Save transaction' }))
}

const buildSeedState = (partialState?: Partial<AppState>): AppState => ({
  transactions: [],
  categories: createDefaultCategories(),
  budgetRules: [],
  preferences: {
    currency: 'HKD',
    weekStartsOn: 1,
  },
  ...partialState,
})

describe('App', () => {
  beforeEach(() => {
    resetTestBackend()
    vi.spyOn(financeModule, 'getNow').mockReturnValue(
      new Date('2026-04-10T09:00:00.000Z'),
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetTestBackend()
  })

  it('gates the app behind auth and keeps cloud-backed data across sign out and sign in', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Sign in to your tracker' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument()

    await signUpWithEmail(user)
    await createTransaction(user, { amount: '120', note: 'Lunch' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('heading', { name: 'Start your own tracker' })).toBeInTheDocument()

    await signInWithEmail(user)
    await user.click(screen.getByRole('button', { name: 'Records' }))

    expect(screen.getByTestId('transactions-mobile-list')).toHaveTextContent('Lunch')
    expect(screen.getByTestId('transactions-table')).toHaveTextContent('Lunch')
  })

  it('supports password reset and Google sign-in', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.type(screen.getByLabelText('Email'), 'reset@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(
      screen.getByText('Password reset email sent. Check your inbox.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await screen.findByText('Google User')
    expect(screen.getByText('Cloud sync enabled')).toBeInTheDocument()
  })

  it('renders overview summary cards and mobile-friendly records from cloud state', async () => {
    seedTestBackend({
      user: {
        uid: 'seed-user',
        email: 'seed@example.com',
        displayName: null,
      },
      state: buildSeedState({
        transactions: [
          {
            id: 'expense-food',
            type: 'expense',
            categoryId: 'expense-food',
            amount: 120,
            occurredAt: '2026-04-10',
            note: 'Groceries',
          },
          {
            id: 'income-salary',
            type: 'income',
            categoryId: 'income-salary',
            amount: 2400,
            occurredAt: '2026-04-10',
            note: 'Payroll',
          },
        ],
        budgetRules: [
          {
            id: 'budget-monthly-total',
            scope: 'total',
            timeframe: 'monthly',
            amount: 900,
            effectiveFrom: '2026-04-01T00:00:00.000Z',
          },
          {
            id: 'budget-monthly-food',
            scope: 'category',
            timeframe: 'monthly',
            categoryId: 'expense-food',
            amount: 500,
            effectiveFrom: '2026-04-01T00:00:00.000Z',
          },
        ],
      }),
    })

    render(<App />)

    expect(await screen.findByTestId('summary-budget')).toHaveTextContent('HK$900.00')
    expect(screen.getByTestId('summary-remaining')).toHaveTextContent('+HK$780.00')
    expect(screen.getByTestId('summary-income')).toHaveTextContent('HK$2,400.00')
    expect(screen.getByTestId('overview-summary-cards')).toHaveTextContent('Food')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Records' }))
    expect(screen.getByTestId('transactions-mobile-list')).toHaveTextContent('Groceries')
  })

  it('keeps each user account isolated from the others', async () => {
    const user = userEvent.setup()

    render(<App />)

    await signUpWithEmail(user, { email: 'first@example.com' })
    await createTransaction(user, { amount: '88', note: 'First account expense' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    await signUpWithEmail(user, { email: 'second@example.com' })
    expect(screen.getByTestId('overview-summary-cards')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Records' }))

    expect(screen.getAllByText('No transactions in this view')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await signInWithEmail(user, { email: 'first@example.com' })
    await user.click(screen.getByRole('button', { name: 'Records' }))

    const mobileRecords = within(screen.getByTestId('transactions-mobile-list'))
    expect(mobileRecords.getByText('First account expense')).toBeInTheDocument()
  })
})
