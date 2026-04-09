# Financial Tracker

A local-first React + TypeScript financial tracker with:

- income and expense transactions
- editable income and expense categories
- versioned budgets for daily, weekly, and monthly periods
- timeframe switching with previous/next navigation
- summary cards, charts, budget table, and transaction table
- browser `localStorage` persistence

## Scripts

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

## Live Site

After GitHub Pages is enabled for the repository, the app will be available at:

`https://hinonso716.github.io/financial-tracker/`

## Notes

- Currency defaults to `HKD`.
- Weekly reporting uses a Monday start.
- Budget edits are scheduled from the next matching period boundary so older reports stay historically correct.
- App state is stored locally under `financial-tracker-state-v1`.
- Because data lives in browser local storage, each friend or device keeps its own separate data unless you later add sync.
