import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import './App.css'
import AuthScreen from './components/AuthScreen'
import TrackerShell from './components/TrackerShell'
import { getAppBackend, type AuthMode, type AuthView } from './lib/backend'
import type { AppState, BudgetRule, Category, Transaction } from './lib/finance'

const backend = getAppBackend()

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.'

function App() {
  const [authView, setAuthView] = useState<AuthView>({
    status: 'loading',
    user: null,
  })
  const [appState, setAppState] = useState<AppState | null>(null)
  const [appStateLoading, setAppStateLoading] = useState(false)
  const [appStateError, setAppStateError] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')

  useEffect(() => backend.subscribeToAuth(setAuthView), [])

  useEffect(() => {
    if (authView.status !== 'signed-in') {
      setAppState(null)
      setAppStateLoading(false)
      setAppStateError('')
      return
    }

    let active = true
    let unsubscribe = () => {}

    setAppStateLoading(true)
    setAppStateError('')

    void (async () => {
      try {
        await backend.ensureUserAppState(authView.user)

        if (!active) {
          return
        }

        unsubscribe = backend.subscribeToAppState(authView.user.uid, (nextState) => {
          if (!active) {
            return
          }

          setAppState(nextState)
          setAppStateLoading(nextState === null)
        })
      } catch (error) {
        if (!active) {
          return
        }

        setAppStateError(getErrorMessage(error))
        setAppStateLoading(false)
      }
    })()

    return () => {
      active = false
      unsubscribe()
    }
  }, [authView])

  useEffect(() => {
    if (authView.status === 'signed-in') {
      setAuthBusy(false)
      setAuthError('')
      setAuthSuccess('')
      setPassword('')
      setConfirmPassword('')
    }
  }, [authView.status])

  const resetAuthFeedback = () => {
    setAuthError('')
    setAuthSuccess('')
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetAuthFeedback()

    if (!email.trim()) {
      setAuthError('Enter your email address.')
      return
    }

    if (authMode === 'signup') {
      if (password.length < 6) {
        setAuthError('Use a password with at least 6 characters.')
        return
      }

      if (password !== confirmPassword) {
        setAuthError('Passwords do not match.')
        return
      }
    }

    if (authMode === 'signin' || authMode === 'signup') {
      if (!password.trim()) {
        setAuthError('Enter your password.')
        return
      }
    }

    try {
      setAuthBusy(true)

      if (authMode === 'signin') {
        await backend.signInWithEmail(email.trim(), password)
      } else if (authMode === 'signup') {
        await backend.signUpWithEmail(email.trim(), password)
      } else {
        await backend.sendResetEmail(email.trim())
        setAuthSuccess('Password reset email sent. Check your inbox.')
      }
    } catch (error) {
      setAuthError(getErrorMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  if (authView.status === 'loading') {
    return (
      <main className="auth-shell">
        <section className="auth-panel loading-panel">
          <p className="eyebrow">Financial Tracker</p>
          <h1>Loading your account...</h1>
          <p className="page-description">
            Connecting the cloud-backed tracker and checking your sign-in session.
          </p>
        </section>
      </main>
    )
  }

  if (authView.status === 'config-error' || authView.status === 'signed-out') {
    return (
      <AuthScreen
        mode={authMode}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        busy={authBusy}
        errorMessage={authError}
        successMessage={authSuccess}
        configMessage={authView.status === 'config-error' ? authView.message : undefined}
        statusMessage={authView.status === 'signed-out' ? authView.message : undefined}
        onModeChange={(mode) => {
          setAuthMode(mode)
          resetAuthFeedback()
        }}
        onEmailChange={(value) => {
          setEmail(value)
          resetAuthFeedback()
        }}
        onPasswordChange={(value) => {
          setPassword(value)
          resetAuthFeedback()
        }}
        onConfirmPasswordChange={(value) => {
          setConfirmPassword(value)
          resetAuthFeedback()
        }}
        onSubmit={handleAuthSubmit}
        onGoogleSignIn={async () => {
          try {
            setAuthBusy(true)
            resetAuthFeedback()
            await backend.signInWithGoogle()
          } catch (error) {
            setAuthError(getErrorMessage(error))
          } finally {
            setAuthBusy(false)
          }
        }}
      />
    )
  }

  if (appStateLoading || !appState) {
    return (
      <main className="auth-shell">
        <section className="auth-panel loading-panel">
          <p className="eyebrow">Preparing your workspace</p>
          <h1>Loading your financial data...</h1>
          <p className="page-description">
            Creating your default categories and syncing your latest transactions.
          </p>
          {appStateError ? <p className="auth-message error">{appStateError}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <TrackerShell
      appState={appState}
      user={authView.user}
      onSignOut={() => backend.signOut()}
      onCreateTransaction={(transaction: Transaction) =>
        backend.createTransaction(authView.user.uid, transaction)
      }
      onUpdateTransaction={(transaction: Transaction) =>
        backend.updateTransaction(authView.user.uid, transaction)
      }
      onDeleteTransaction={(transactionId: string) =>
        backend.deleteTransaction(authView.user.uid, transactionId)
      }
      onCreateCategory={(category: Category) =>
        backend.createCategory(authView.user.uid, category)
      }
      onUpdateCategory={(category: Category) =>
        backend.updateCategory(authView.user.uid, category)
      }
      onCreateBudgetRule={(budgetRule: BudgetRule) =>
        backend.createBudgetRule(authView.user.uid, budgetRule)
      }
      onUpdatePreferences={(preferences) =>
        backend.updatePreferences(authView.user.uid, preferences)
      }
    />
  )
}

export default App
