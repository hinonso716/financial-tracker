# Financial Tracker

A mobile-first React + TypeScript financial tracker with Firebase accounts, Firestore-backed per-user data, Firebase Hosting as the primary web target, GitHub Pages as a legacy fallback build, and Capacitor wrappers for iPhone and Android.

Primary web host after Firebase Hosting deploy:

`https://financial-tracker-5128e.firebaseapp.com/`

Legacy GitHub Pages URL:

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

## Why Firebase Hosting

Google sign-in on phones is more reliable when the web app is served from Firebase Hosting instead of GitHub Pages. This repo now keeps:

- Firebase Hosting as the main production web target
- GitHub Pages as a secondary legacy build target

For the best mobile auth behavior, use the Firebase Hosting URL above.

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

- create or open the `financial-tracker-5128e` Firebase project
- enable Firestore Database
- enable Authentication
- enable `Email/Password`
- enable `Google`
- make sure these authorized domains are available:
  - `localhost`
  - `hinonso716.github.io`
  - `financial-tracker-5128e.firebaseapp.com`
  - `financial-tracker-5128e.web.app`

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
npm run build:hosting
npm run build:pages
npm run build:native
npm run hosting:serve
npm run hosting:deploy
npm run cap:sync
npm run ios:open
npm run android:open
```

## Deployment

### Firebase Hosting

This repo includes [`firebase.json`](./firebase.json) and [`.firebaserc`](./.firebaserc) for the `financial-tracker-5128e` project.

To deploy manually:

```bash
npx firebase-tools login --no-localhost
npm run hosting:deploy
```

The hosting build uses root `/` asset paths and outputs to `dist/`.

### GitHub Pages

The GitHub Pages workflow remains in place as a fallback/legacy deployment and now builds with the Pages-specific base path.

Required GitHub repository variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

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

Those wrappers are not the focus of this Firebase Hosting phase, but the shared UI is kept compatible with narrow phone layouts.
