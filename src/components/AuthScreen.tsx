import type { FormEvent } from 'react'

import type { AuthMode } from '../lib/backend'

type AuthScreenProps = {
  mode: AuthMode
  email: string
  password: string
  confirmPassword: string
  busy: boolean
  errorMessage: string
  successMessage: string
  configMessage?: string
  statusMessage?: string
  onModeChange: (mode: AuthMode) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onGoogleSignIn: () => void
}

const authModeMeta: Record<
  AuthMode,
  {
    eyebrow: string
    title: string
    description: string
    submitLabel: string
  }
> = {
  signin: {
    eyebrow: 'Welcome back',
    title: 'Sign in to your tracker',
    description: 'Your budgets, records, and overview stay tied to your own account.',
    submitLabel: 'Sign in',
  },
  signup: {
    eyebrow: 'Create account',
    title: 'Start your own tracker',
    description: 'Use email/password or Google, then your data syncs to your account.',
    submitLabel: 'Create account',
  },
  reset: {
    eyebrow: 'Password reset',
    title: 'Reset your password',
    description: 'Enter your email and we will send a password reset link.',
    submitLabel: 'Send reset link',
  },
}

function AuthScreen({
  mode,
  email,
  password,
  confirmPassword,
  busy,
  errorMessage,
  successMessage,
  configMessage,
  statusMessage,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onGoogleSignIn,
}: AuthScreenProps) {
  const meta = authModeMeta[mode]
  const showGoogle = mode !== 'reset'

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-copy">
          <p className="eyebrow">{meta.eyebrow}</p>
          <h1>{meta.title}</h1>
          <p className="page-description">{meta.description}</p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication views">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => onModeChange('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => onModeChange('signup')}
          >
            Create account
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'reset' ? 'active' : ''}`}
            onClick={() => onModeChange('reset')}
          >
            Reset
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          {mode !== 'reset' ? (
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
          ) : null}

          {mode === 'signup' ? (
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                placeholder="Repeat your password"
              />
            </label>
          ) : null}

          <div className="auth-actions">
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? 'Working...' : meta.submitLabel}
            </button>

            {mode === 'signin' ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => onModeChange('reset')}
              >
                Forgot password?
              </button>
            ) : null}
          </div>

          {showGoogle ? (
            <button
              type="button"
              className="button auth-provider-button"
              onClick={onGoogleSignIn}
              disabled={busy}
            >
              Continue with Google
            </button>
          ) : null}

          {errorMessage ? <p className="auth-message error">{errorMessage}</p> : null}
          {successMessage ? <p className="auth-message success">{successMessage}</p> : null}
          {statusMessage ? <p className="auth-message info">{statusMessage}</p> : null}
          {configMessage ? <p className="auth-message warning">{configMessage}</p> : null}
        </form>
      </section>
    </main>
  )
}

export default AuthScreen
