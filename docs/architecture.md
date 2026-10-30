# Architecture

[README](../README.md) | [Database](database.md) | [Business rules](business-rules.md) | [Testing](testing.md) | [Roadmap](roadmap.md)

## Application Boundary

FinInsight is one Next.js App Router application under `frontend/`. React screens, route handlers, authentication, domain logic, and Prisma integration run within this application. The repository does not provide an independent backend process, queue worker, or bank synchronization service.

```text
Protected server page --auth()--> session or login redirect
         |
Client components --fetch--> app/api route handler
                                  |
                          session -> user lookup
                                  |
                    validation + ownership checks
                                  |
                          lib domain helpers
                                  |
                    Prisma / PrismaPg -> PostgreSQL
```

The browser does not connect directly to the database. Account-history helpers are pure functions reused in client-side presentation and server-side summaries; server-only database access stays behind route handlers and services.

## Main Responsibilities

| Path, relative to `frontend/` | Responsibility |
| --- | --- |
| `app/*/page.tsx` | Page composition and server-side session guards for financial screens. |
| `app/api/` | HTTP parsing, authentication, resource authorization, validation, and JSON responses. |
| `auth.ts` | Auth.js credentials provider, bcrypt comparison, JWT session strategy. The installed Prisma Auth adapter is not configured here. |
| `components/ui/` | Repository-owned shadcn/ui components built on Radix primitives. |
| `components/accounts/`, `components/categories/`, `components/budgets/` | Feature screens and dialogs. Other feature components also live directly in `components/`. |
| `lib/validations/` | Zod schemas for financial resources and filters. |
| `lib/accounts/` | Account serialization, signed movements, full-history replay, selected-scope monthly balances. |
| `lib/budgets/` | Cent-based arithmetic, recurring commitments, variable spending, actual and planning summaries. |
| `lib/recurring/` | Detection, persistent confirmation, matching, activity transitions, editing, and serialization. |
| `lib/finance-events.ts` | Client refresh notifications, cross-tab broadcasts, focus/visibility refresh, and polling. |
| `hooks/use-active-transaction.ts` | Visible-row tracking and keyboard-driven selection; no monetary calculation. |
| `lib/prisma.ts` | Generated Prisma client with the PostgreSQL driver adapter and development singleton. |
| `prisma.config.ts` | Prisma CLI schema path, migration directory, and connection environment variable. |

## HTTP Surface

All financial endpoints below authenticate on the server. Registration and Auth.js authentication endpoints are intentionally public entry points.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | `GET`, `POST` | Auth.js handlers. |
| `/api/register` | `POST` | Register a user and create default account/category records. |
| `/api/accounts` and `/api/accounts/[id]` | `GET`, `POST`; `PATCH`, `DELETE` | Accounts, computed balances, primary status, archiving, guarded deletion. |
| `/api/transactions` and `/api/transactions/[id]` | `GET`, `POST`; `PATCH`, `DELETE` | Income, expenses, and transfers. The list returns the full owned history. |
| `/api/categories` and `/api/categories/[id]` | `GET`, `POST`; `PATCH`, `DELETE` | Owned categories and guarded updates/deletion. |
| `/api/categories/analytics` | `GET` | Period-based category totals and comparisons. |
| `/api/dashboard/summary`, `/api/dashboard/chart` | `GET` | Dashboard indicators and period charts. |
| `/api/budgets` and `/api/budgets/[id]` | `GET`, `POST`; `PATCH`, `DELETE` | Monthly variable envelopes; list response also contains planning, actual spending, and account-scope summaries. |
| `/api/budgets/emergency-reserve` | `PUT` | Upsert the planned reserve for a month. |
| `/api/recurring-transactions` and `/api/recurring-transactions/[id]` | `GET`, `POST`; `PATCH`, `DELETE` | Recurring definitions and lifecycle changes. |
| `/api/recurring-transactions/suggestions` | `GET` | Detect current expense suggestions without confirming them. |
| `/api/recurring-transactions/confirm` | `POST` | Recompute and confirm a suggestion with persistent source associations. |
| `/api/recurring-transactions/[id]/payments` | `POST` | Explicitly associate an uncertain real expense with a charge. |

The budgets list accepts `month` and `year`; optional comma-separated `accountIds` affects the account-scope balance breakdown, not the user-wide planning or actual expense totals. Transaction URL parameters select existing client filters; they are not additional API endpoints.

## Important Data Flows

### Budget Screen

`BudgetsManager` requests the selected month from `/api/budgets`. `getMonthlyBudgetActivity()` loads actual income/expenses and recurring definitions for that user, reconciles real payments, and provides variable spending, actual spending, and retained recurring commitments. `calculateBudgetSummary()` combines these with envelopes and the monthly reserve. The account-history service separately builds the selected account balances.

The UI displays these server values rather than deriving an alternative allocation formula. Creation, editing, status changes, reconciliation, and reserve changes trigger reloads while retaining the selected month.

### Recurring Confirmation

The suggestions route reads owned expense history. Confirmation validates the payload, recomputes the current suggestions server-side, checks the selected account/category and source ownership, and creates the definition plus source links in a database transaction. Unique source constraints resolve duplicate confirmations. It never creates a bank transaction.

### Interactive Transaction History

`TransactionsTable` loads accounts and the full transaction list. `buildAccountBalanceHistory()` replays the complete selected scope before text, date, type, or category filters. The resulting map supplies each transaction's balance.

The sticky panel reads the active transaction's existing balance. `IntersectionObserver`, passive scroll notifications, `ResizeObserver`, and `requestAnimationFrame` track visibility without creating a nested vertical scrolling area. Keyboard focus and previous/next controls select rows; reduced-motion preferences disable the amount fade and row transition. Account URLs use `/transactions?accountId=...`; selecting another scope updates the URL without reloading the page.

## Refresh and Compatibility Notes

- Subscribed financial screens use `notifyFinanceChanged()` / `subscribeFinanceChanges()`, including `BroadcastChannel` when available. Subscribers also refresh on focus, visibility, and every 30 seconds. This is not a WebSocket or server-push system; not all dashboard components use this mechanism.
- Legacy compatibility helpers are not read-only: account/category/dashboard reads can create missing defaults or attach legacy transactions to accounts/categories. Do not use arbitrary authenticated GET requests against personal data as a supposedly write-free audit.
- The transaction list currently loads all owned transactions and filters client-side; there is no server pagination or virtualized history. Detection also evaluates candidate sequences in memory. These are MVP scale limits.
- Older dashboard handlers still contain separate floating-point and server-local-date calculations. Budget and account-history helpers are more centralized; the documentation does not imply that every summary already shares the same implementation.

For financial semantics see [Business Rules](business-rules.md); for schema-level guarantees and their boundaries see [Database](database.md).
