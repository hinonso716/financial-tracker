# Financial Tracker

A mobile-first React + TypeScript financial tracker with Firebase accounts, Firestore-backed per-user data, GitHub Pages hosting for the web app, and Capacitor wrappers for iPhone and Android.

Live site:

`https://hinonso716.github.io/financial-tracker/`

## What It Does

- Email/password sign up and sign in
- Google sign in
- Password reset flow
- Per-user cloud data in Firestore
- Offline-friendly Firestore cache with cloud sync as the source of truth
- Four app sections: transaction input, categories and budgets, transaction records, and finance overview
- Mobile-first layout with phone-friendly record cards and overview summary cards
- Daily, weekly, and monthly budgets that apply immediately

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your Firebase web config values:

```bash
cp .env.example .env
```

3. In Firebase Console:

- create a Firebase project
- enable Firestore Database
- enable Authentication
- enable `Email/Password`
- enable `Google`
- add `localhost` and `hinonso716.github.io` to Authentication > Settings > Authorized domains

4. Apply the Firestore rules from [`firestore.rules`](./firestore.rules).

5. Start the app:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
npm run build:web
npm run build:native
npm run cap:sync
npm run ios:open
npm run android:open
```

## GitHub Pages + Firebase Config

The GitHub Pages workflow builds the app from `main` and expects these repository variables in GitHub:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Add them under `Settings > Secrets and variables > Actions > Variables`.

## Data Behavior

- Financial data is stored per account in Firestore under `users/{uid}/...`
- The old custom `localStorage` app bundle is no longer the source of truth
- Firestore offline persistence may cache recent data locally, but the canonical data lives in the signed-in user account
- Existing browser-local demo data is not migrated into Firebase
- Web, iPhone, and Android still keep separate local caches until a sync strategy is added for the native shells

## Mobile Wrappers

The current repo still includes Capacitor iOS and Android projects. The web app remains the main source of truth for UI and business logic.

- iPhone: run `npm run cap:sync`, then `npm run ios:open`
- Android: run `npm run cap:sync`, then `npm run android:open`

Those wrappers are not the focus of this Firebase web phase, but the shared UI is kept compatible with narrow phone layouts.
