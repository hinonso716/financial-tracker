import { FirebaseError, initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  enableIndexedDbPersistence,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore'

import {
  DEFAULT_PREFERENCES,
  createDefaultCategories,
  createEmptyState,
  isBudgetRule,
  isCategory,
  isTransaction,
} from './defaults'
import type {
  AppState,
  BudgetRule,
  Category,
  Preferences,
  Transaction,
} from './finance'

export type AuthMode = 'signin' | 'signup' | 'reset'

export type AppUser = {
  uid: string
  email: string | null
  displayName: string | null
}

export type AuthView =
  | {
      status: 'loading'
      user: null
      message?: string
    }
  | {
      status: 'config-error'
      user: null
      message: string
    }
  | {
      status: 'signed-out'
      user: null
      message?: string
    }
  | {
      status: 'signed-in'
      user: AppUser
      message?: string
    }

export type AppBackend = {
  subscribeToAuth: (listener: (view: AuthView) => void) => () => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  sendResetEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  ensureUserAppState: (user: AppUser) => Promise<void>
  subscribeToAppState: (
    uid: string,
    listener: (state: AppState | null) => void,
  ) => () => void
  createTransaction: (uid: string, transaction: Transaction) => Promise<void>
  updateTransaction: (uid: string, transaction: Transaction) => Promise<void>
  deleteTransaction: (uid: string, transactionId: string) => Promise<void>
  createCategory: (uid: string, category: Category) => Promise<void>
  updateCategory: (uid: string, category: Category) => Promise<void>
  createBudgetRule: (uid: string, budgetRule: BudgetRule) => Promise<void>
}

type TestSeed = {
  user?: AppUser | null
  state?: AppState
}

const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingFirebaseKeys = REQUIRED_FIREBASE_ENV_KEYS.filter(
  (key) => !import.meta.env[key],
)

const hasFirebaseConfig = missingFirebaseKeys.length === 0

const getConfigErrorMessage = () =>
  `Firebase is not configured yet. Add ${missingFirebaseKeys.join(', ')} to your local .env file and GitHub Pages build variables.`

const cloneAppState = (state: AppState): AppState =>
  typeof structuredClone === 'function'
    ? structuredClone(state)
    : (JSON.parse(JSON.stringify(state)) as AppState)

const sortCategories = (categories: Category[]) =>
  [...categories].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind)
    }

    return left.name.localeCompare(right.name)
  })

const sortTransactions = (transactions: Transaction[]) =>
  [...transactions].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) {
      return right.occurredAt.localeCompare(left.occurredAt)
    }

    return right.id.localeCompare(left.id)
  })

const sortBudgetRules = (budgetRules: BudgetRule[]) =>
  [...budgetRules].sort((left, right) => {
    if (left.effectiveFrom !== right.effectiveFrom) {
      return right.effectiveFrom.localeCompare(left.effectiveFrom)
    }

    return right.id.localeCompare(left.id)
  })

const normalizePreferences = (
  preferences?: Partial<Preferences> | null,
): Preferences => ({
  currency:
    preferences?.currency === 'HKD' ? 'HKD' : DEFAULT_PREFERENCES.currency,
  weekStartsOn:
    preferences?.weekStartsOn === 1 ? 1 : DEFAULT_PREFERENCES.weekStartsOn,
})

const normalizeAppState = (state: AppState): AppState => ({
  transactions: sortTransactions(state.transactions),
  categories: sortCategories(state.categories),
  budgetRules: sortBudgetRules(state.budgetRules),
  preferences: normalizePreferences(state.preferences),
})

const mapFirebaseUser = (user: User): AppUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
})

const getFirebaseErrorCode = (error: unknown) => {
  if (error instanceof FirebaseError) {
    return error.code
  }

  if (error instanceof Error && error.message.startsWith('auth/')) {
    return error.message
  }

  return null
}

const formatBackendError = (error: unknown) => {
  const firebaseCode = getFirebaseErrorCode(error)

  switch (firebaseCode) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/missing-password':
      return 'Enter your password.'
    case 'auth/invalid-credential':
      return 'The email or password is incorrect.'
    case 'auth/user-not-found':
      return 'We could not find an account for that email address.'
    case 'auth/email-already-in-use':
      return 'That email address is already being used.'
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.'
    case 'auth/popup-blocked':
      return 'Google sign-in was blocked by the browser. Try again.'
    case 'auth/unauthorized-domain':
      return 'This domain is not allowed for Google sign-in yet.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts were made. Please wait a moment and try again.'
    default:
      if (error instanceof Error) {
        return error.message
      }

      return 'Something went wrong. Please try again.'
  }
}

const toAppError = (error: unknown) => {
  if (getFirebaseErrorCode(error)) {
    return new Error(formatBackendError(error))
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Something went wrong. Please try again.')
}

const isCompactViewport = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 760px)').matches

const createConfigErrorBackend = (): AppBackend => ({
  subscribeToAuth(listener) {
    listener({
      status: 'config-error',
      user: null,
      message: getConfigErrorMessage(),
    })

    return () => {}
  },
  async signInWithEmail() {
    throw new Error(getConfigErrorMessage())
  },
  async signUpWithEmail() {
    throw new Error(getConfigErrorMessage())
  },
  async signInWithGoogle() {
    throw new Error(getConfigErrorMessage())
  },
  async sendResetEmail() {
    throw new Error(getConfigErrorMessage())
  },
  async signOut() {
    throw new Error(getConfigErrorMessage())
  },
  async ensureUserAppState() {},
  subscribeToAppState(_uid, listener) {
    listener(null)
    return () => {}
  },
  async createTransaction() {
    throw new Error(getConfigErrorMessage())
  },
  async updateTransaction() {
    throw new Error(getConfigErrorMessage())
  },
  async deleteTransaction() {
    throw new Error(getConfigErrorMessage())
  },
  async createCategory() {
    throw new Error(getConfigErrorMessage())
  },
  async updateCategory() {
    throw new Error(getConfigErrorMessage())
  },
  async createBudgetRule() {
    throw new Error(getConfigErrorMessage())
  },
})

class MemoryAppBackend implements AppBackend {
  private authView: AuthView = { status: 'signed-out', user: null }
  private authListeners = new Set<(view: AuthView) => void>()
  private stateListeners = new Map<string, Set<(state: AppState | null) => void>>()
  private users = new Map<
    string,
    {
      user: AppUser
      password: string
      state: AppState
    }
  >()

  reset() {
    this.authView = { status: 'signed-out', user: null }
    this.authListeners.clear()
    this.stateListeners.clear()
    this.users.clear()
  }

  seed({ user, state }: TestSeed = {}) {
    this.reset()

    if (!user) {
      return
    }

    this.users.set(user.uid, {
      user,
      password: 'password123',
      state: normalizeAppState(state ?? createEmptyState()),
    })
    this.authView = { status: 'signed-in', user }
  }

  subscribeToAuth(listener: (view: AuthView) => void) {
    this.authListeners.add(listener)
    listener(this.authView)
    return () => {
      this.authListeners.delete(listener)
    }
  }

  async signInWithEmail(email: string, password: string) {
    const record = [...this.users.values()].find((entry) => entry.user.email === email)

    if (!record || record.password !== password) {
      throw new Error('The email or password is incorrect.')
    }

    this.authView = { status: 'signed-in', user: record.user }
    this.emitAuth()
  }

  async signUpWithEmail(email: string, password: string) {
    const existing = [...this.users.values()].find((entry) => entry.user.email === email)

    if (existing) {
      throw new Error('That email address is already being used.')
    }

    const user: AppUser = {
      uid: `user-${crypto.randomUUID()}`,
      email,
      displayName: null,
    }

    this.users.set(user.uid, {
      user,
      password,
      state: normalizeAppState(createEmptyState()),
    })
    this.authView = { status: 'signed-in', user }
    this.emitAuth()
    this.emitState(user.uid)
  }

  async signInWithGoogle() {
    const existing = [...this.users.values()].find(
      (entry) => entry.user.email === 'google.user@example.com',
    )

    if (existing) {
      this.authView = { status: 'signed-in', user: existing.user }
      this.emitAuth()
      return
    }

    const user: AppUser = {
      uid: `google-${crypto.randomUUID()}`,
      email: 'google.user@example.com',
      displayName: 'Google User',
    }

    this.users.set(user.uid, {
      user,
      password: '',
      state: normalizeAppState(createEmptyState()),
    })
    this.authView = { status: 'signed-in', user }
    this.emitAuth()
    this.emitState(user.uid)
  }

  async sendResetEmail(email: string) {
    void email
  }

  async signOut() {
    this.authView = { status: 'signed-out', user: null }
    this.emitAuth()
  }

  async ensureUserAppState(user: AppUser) {
    if (!this.users.has(user.uid)) {
      this.users.set(user.uid, {
        user,
        password: '',
        state: normalizeAppState(createEmptyState()),
      })
    }
  }

  subscribeToAppState(uid: string, listener: (state: AppState | null) => void) {
    const listeners = this.stateListeners.get(uid) ?? new Set()
    listeners.add(listener)
    this.stateListeners.set(uid, listeners)

    const state = this.users.get(uid)?.state ?? null
    listener(state ? cloneAppState(state) : null)

    return () => {
      const nextListeners = this.stateListeners.get(uid)
      nextListeners?.delete(listener)
      if (nextListeners && nextListeners.size === 0) {
        this.stateListeners.delete(uid)
      }
    }
  }

  async createTransaction(uid: string, transaction: Transaction) {
    const record = this.requireUser(uid)
    record.state.transactions = normalizeAppState({
      ...record.state,
      transactions: [transaction, ...record.state.transactions],
    }).transactions
    this.emitState(uid)
  }

  async updateTransaction(uid: string, transaction: Transaction) {
    const record = this.requireUser(uid)
    record.state.transactions = normalizeAppState({
      ...record.state,
      transactions: record.state.transactions.map((entry) =>
        entry.id === transaction.id ? transaction : entry,
      ),
    }).transactions
    this.emitState(uid)
  }

  async deleteTransaction(uid: string, transactionId: string) {
    const record = this.requireUser(uid)
    record.state.transactions = record.state.transactions.filter(
      (transaction) => transaction.id !== transactionId,
    )
    this.emitState(uid)
  }

  async createCategory(uid: string, category: Category) {
    const record = this.requireUser(uid)
    record.state.categories = normalizeAppState({
      ...record.state,
      categories: [...record.state.categories, category],
    }).categories
    this.emitState(uid)
  }

  async updateCategory(uid: string, category: Category) {
    const record = this.requireUser(uid)
    record.state.categories = normalizeAppState({
      ...record.state,
      categories: record.state.categories.map((entry) =>
        entry.id === category.id ? category : entry,
      ),
    }).categories
    this.emitState(uid)
  }

  async createBudgetRule(uid: string, budgetRule: BudgetRule) {
    const record = this.requireUser(uid)
    record.state.budgetRules = normalizeAppState({
      ...record.state,
      budgetRules: [...record.state.budgetRules, budgetRule],
    }).budgetRules
    this.emitState(uid)
  }

  private requireUser(uid: string) {
    const record = this.users.get(uid)

    if (!record) {
      throw new Error('User account not found.')
    }

    return record
  }

  private emitAuth() {
    this.authListeners.forEach((listener) => listener(this.authView))
  }

  private emitState(uid: string) {
    const record = this.users.get(uid)
    const listeners = this.stateListeners.get(uid)

    if (!record || !listeners) {
      return
    }

    const state = cloneAppState(record.state)
    listeners.forEach((listener) => listener(state))
  }
}

const testBackend = new MemoryAppBackend()

export const resetTestBackend = () => {
  if (import.meta.env.MODE === 'test') {
    testBackend.reset()
  }
}

export const seedTestBackend = (seed?: TestSeed) => {
  if (import.meta.env.MODE === 'test') {
    testBackend.seed(seed)
  }
}

const createFirebaseBackend = (): AppBackend => {
  const app = initializeApp(firebaseEnv)
  const auth = getAuth(app)
  const db = getFirestore(app)

  if (typeof window !== 'undefined') {
    void enableIndexedDbPersistence(db).catch(() => undefined)
  }

  let pendingMessage: string | undefined
  const redirectResultPromise = getRedirectResult(auth)
    .then(() => undefined)
    .catch((error) => {
      pendingMessage = formatBackendError(
        error,
      )
      return undefined
    })

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  return {
    subscribeToAuth(listener) {
      let unsubscribe = () => {}
      let active = true

      listener({ status: 'loading', user: null })

      void redirectResultPromise.then(() => {
        if (!active) {
          return
        }

        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            listener({
              status: 'signed-in',
              user: mapFirebaseUser(user),
              message: pendingMessage,
            })
          } else {
            listener({
              status: 'signed-out',
              user: null,
              message: pendingMessage,
            })
          }

          pendingMessage = undefined
        })
      })

      return () => {
        active = false
        unsubscribe()
      }
    },

    async signInWithEmail(email, password) {
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async signUpWithEmail(email, password) {
      try {
        await createUserWithEmailAndPassword(auth, email, password)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async signInWithGoogle() {
      try {
        if (isCompactViewport()) {
          await signInWithRedirect(auth, provider)
          return
        }

        await signInWithPopup(auth, provider)
      } catch (error) {
        const firebaseCode = getFirebaseErrorCode(error)

        if (
          firebaseCode === 'auth/popup-blocked' ||
          firebaseCode === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(auth, provider)
          return
        }

        throw toAppError(error)
      }
    },

    async sendResetEmail(email) {
      try {
        await sendPasswordResetEmail(auth, email)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async signOut() {
      await firebaseSignOut(auth)
    },

    async ensureUserAppState(user) {
      const preferencesRef = doc(db, 'users', user.uid, 'preferences', 'app')
      const categoriesCollection = collection(db, 'users', user.uid, 'categories')

      const [preferencesSnapshot, categoriesSnapshot] = await Promise.all([
        getDoc(preferencesRef),
        getDocs(categoriesCollection),
      ])

      const batch = writeBatch(db)
      let shouldCommit = false

      if (!preferencesSnapshot.exists()) {
        batch.set(preferencesRef, DEFAULT_PREFERENCES)
        shouldCommit = true
      }

      if (categoriesSnapshot.empty) {
        createDefaultCategories().forEach((category) => {
          batch.set(doc(categoriesCollection, category.id), category)
        })
        shouldCommit = true
      }

      if (shouldCommit) {
        await batch.commit()
      }
    },

    subscribeToAppState(uid, listener) {
      const nextState = createEmptyState()
      const ready = {
        transactions: false,
        categories: false,
        budgetRules: false,
        preferences: false,
      }

      const publishIfReady = () => {
        if (Object.values(ready).every(Boolean)) {
          listener(normalizeAppState(nextState))
        }
      }

      const unsubs = [
        onSnapshot(collection(db, 'users', uid, 'transactions'), (snapshot) => {
          nextState.transactions = sortTransactions(
            snapshot.docs
              .map((docSnapshot) => docSnapshot.data())
              .filter(isTransaction),
          )
          ready.transactions = true
          publishIfReady()
        }),
        onSnapshot(collection(db, 'users', uid, 'categories'), (snapshot) => {
          nextState.categories = sortCategories(
            snapshot.docs
              .map((docSnapshot) => docSnapshot.data())
              .filter(isCategory),
          )
          ready.categories = true
          publishIfReady()
        }),
        onSnapshot(collection(db, 'users', uid, 'budgetRules'), (snapshot) => {
          nextState.budgetRules = sortBudgetRules(
            snapshot.docs
              .map((docSnapshot) => docSnapshot.data())
              .filter(isBudgetRule),
          )
          ready.budgetRules = true
          publishIfReady()
        }),
        onSnapshot(doc(db, 'users', uid, 'preferences', 'app'), (snapshot) => {
          nextState.preferences = snapshot.exists()
            ? normalizePreferences(snapshot.data() as Partial<Preferences>)
            : DEFAULT_PREFERENCES
          ready.preferences = true
          publishIfReady()
        }),
      ]

      return () => {
        unsubs.forEach((unsubscribe) => unsubscribe())
      }
    },

    async createTransaction(uid, transaction) {
      await setDoc(doc(db, 'users', uid, 'transactions', transaction.id), transaction)
    },

    async updateTransaction(uid, transaction) {
      await setDoc(doc(db, 'users', uid, 'transactions', transaction.id), transaction)
    },

    async deleteTransaction(uid, transactionId) {
      await deleteDoc(doc(db, 'users', uid, 'transactions', transactionId))
    },

    async createCategory(uid, category) {
      await setDoc(doc(db, 'users', uid, 'categories', category.id), category)
    },

    async updateCategory(uid, category) {
      await setDoc(doc(db, 'users', uid, 'categories', category.id), category)
    },

    async createBudgetRule(uid, budgetRule) {
      await setDoc(doc(db, 'users', uid, 'budgetRules', budgetRule.id), budgetRule)
    },
  }
}

let backendSingleton: AppBackend | null = null

export const getAppBackend = () => {
  if (backendSingleton) {
    return backendSingleton
  }

  if (import.meta.env.MODE === 'test') {
    backendSingleton = testBackend
    return backendSingleton
  }

  backendSingleton = hasFirebaseConfig
    ? createFirebaseBackend()
    : createConfigErrorBackend()

  return backendSingleton
}
