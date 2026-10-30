# Testing and Verification

[README](../README.md) | [Architecture](architecture.md) | [Database](database.md) | [Business rules](business-rules.md) | [Roadmap](roadmap.md)

## Running Checks

From `frontend/`, after installing dependencies:

```bash
node --experimental-strip-types --test
npm run typecheck
npm run lint
```

Node discovers the colocated `.test.mjs` files. Some import TypeScript directly; `--experimental-strip-types` is needed on the locally checked Node 22.14.0 runtime. Other tests transpile modules in memory with the installed TypeScript package. Expected Node warnings about experimental stripping or module-type detection are not test failures; do not change package module semantics merely to suppress them.

There is no `npm test` script. `npm run typecheck` runs `tsc --noEmit --incremental false`; `npm run lint` invokes ESLint with the Next.js flat configuration. Type transpilation in a test is not a substitute for the separate typecheck.

A targeted run can be used while working on a domain:

```bash
node --experimental-strip-types --test lib/accounts/history.test.mjs lib/accounts/scope-summary.test.mjs
node --experimental-strip-types --test lib/recurring/detection.test.mjs lib/recurring/reconciliation.test.mjs
node --experimental-strip-types --test lib/transactions/active-row.test.mjs components/transactions/transaction-balance-panel.test.mjs
```

For production compilation, use the [installation prerequisites](../README.md#getting-started), including client generation and environment configuration, then run:

```bash
npm run build
```

The Google fonts configured in `app/layout.tsx` may require network access during a fresh build. A production build is not a database migration and does not replace runtime smoke tests.

## Test Organization

There are 20 test files in the reviewed repository.

| Location | Coverage |
| --- | --- |
| `lib/accounts/*.test.mjs` | Signed scope movements, transfers to savings, opening/closing carry, incomplete history, chronological ties, full-history replay, user-scoped transaction listing. |
| `lib/budgets/*.test.mjs` | Planned commitments, actual recurring overrides, reserve validation, allocation arithmetic, actual monthly category review, negative amounts, cumulative results. |
| `lib/recurring/*.test.mjs` | Detection series, confirmation-form payloads, lifecycle periods, price/date/account edits, matching and manual payment confirmation, status helpers, sibling key regressions. |
| `lib/transactions/active-row.test.mjs` | Visible-row geometry, both scroll directions, focus priority, covered rows, empty results, end-of-page selection. |
| `lib/finance-events.test.mjs` | Refresh notifications, visibility/focus, polling, and cleanup. |
| `components/**/*.test.mjs` | Server-rendered account links, monthly review presentation, and sticky balance panel output, controls, missing/negative amounts, and motion-safe styling. |

Named regression scenarios include independent Apple series, distinct Free Mobile series, Adobe across a missing month, and a manually created recurring cinema charge. Fixtures are isolated test inputs, not a dump of personal bank data.

## Isolation and What Tests Prove

[`lib/testing/load-ts.mjs`](../frontend/lib/testing/load-ts.mjs) loads real application TypeScript while injecting explicit authentication and Prisma mocks. It refuses unmocked `@/auth` and `@/lib/prisma` imports. Several route-level tests provide in-memory transactions, relation results, and simulated conflict errors. Component tests use React server rendering; some regression checks inspect source structure.

These tests verify business behavior and handler contracts without connecting to PostgreSQL or changing financial records. Mocked conflicts do not prove actual concurrent behavior against a live database. Source/markup assertions do not prove browser layout, scrolling, or full accessibility. No coverage percentage is configured or claimed.

## Observed Local Results

Checked on **2026-10-30**, with **Node 22.14.0**, during the documentation update:

| Command | Observation |
| --- | --- |
| `node --experimental-strip-types --test` | 188 passed, 0 failed; 23 suites. |
| `npm run typecheck` | Passed, exit code 0. |
| `npm run lint` | Passed, exit code 0; no errors reported. |
| `npm run build` | Success reported by the developer for an earlier local run; not rerun during this documentation-only update. |

These are local observations, not a permanently green CI claim. No committed CI workflow or Playwright test configuration is supplied. Authenticated end-to-end behavior and live PostgreSQL constraints were not exercised by this documentation task. No migrations, seeding, or schema-push operations were executed.

The Prisma CLI help confirms the documented `migrate deploy` and `generate` commands, and the paths were checked against `prisma.config.ts`. A fresh clone/install/database initialization was not performed, so the installation sequence is reviewed, not an end-to-end installation test.

## Manual Browser Checklist

Use a separate disposable development database or API mocks, never a personal financial history for destructive tests.

1. Sign up and sign in; verify protected pages redirect without a session and financial APIs reject unauthenticated requests.
2. Create income, an expense, and a transfer between two owned test accounts. Check both account views and the combined scope; a transfer within the scope must cancel out.
3. Open an account's transaction link; combine search, type, category, account, and partial-date filters. Change chronological order and reset filters.
4. Scroll both ways on desktop and mobile. Compare the sticky panel with the active transaction's full-history balance. Exercise row focus, arrow keys, Home/End, panel controls, and reduced motion.
5. Change an earlier test transaction and verify later balances refresh. Cancel edit/delete dialogs and verify cancellation performs no write.
6. Create a manual monthly expense definition without a real payment. Only planning should change. Then enter a real payment, resolve ambiguity if needed, and verify the actual/variable split without double counting.
7. Change selected month, reserve, and envelope amounts; check positive, exact-zero, and negative allocation results. Check a category with expenses but no envelope.
8. Deactivate/reactivate a charge and correct an effective end date with explicit historical confirmation. Confirm closed and inactive months remain meaningful.

Some existing authenticated GET handlers run default/legacy normalization helpers. A manual read-only database audit must not assume every HTTP GET is free of writes. See [Architecture](architecture.md#refresh-and-compatibility-notes).
