# FinInsight

A full-stack personal finance application that separates everyday spending, monthly planning, and recorded account balances.

## Project Overview

FinInsight helps users understand where their money goes, plan variable spending after recurring commitments, and review how their accounts have evolved over time. Accounts and transactions are entered manually; the application does not connect to banking providers.

Built as a full-stack portfolio project, it explores relational data modeling, user-scoped APIs, recurring-payment detection, historical balance reconstruction, and the distinction between a forecast and a real payment. The interface is primarily in French and the current monetary workflows target EUR.

**Status:** actively developed MVP. Calculated balances depend on the opening balances and history supplied by the user; they are not bank-verified balances.

## Features

| Area | Implemented capabilities |
| --- | --- |
| Authentication | Registration, credentials-based login, hashed passwords, Auth.js sessions, protected financial pages and APIs. |
| Dashboard | Current-month income and expenses, account-based balance summaries, category distribution, recent transactions, period charts, and a rule-based spending insight. |
| Accounts | Manually create and edit accounts, record opening balances, choose a primary account, archive accounts, and navigate to their filtered transactions. Account types include checking, savings, cash, investment, credit, and other. |
| Transactions | Create, edit, and delete income, expenses, and internal transfers. Combine text search, type, category, account, and partial French-date filters; switch chronological order. |
| Internal transfers | One operation links an owned source account to an owned destination account. It appears in both accounts' histories without becoming income or an expense. |
| Categories | User-owned income and expense categories, icons and colors, category management, and spending analysis. Default categories are supplied at registration. |
| Monthly budgets | Variable envelopes by expense category, allocation totals, remaining amounts, and explicit overspending or overallocation. Categories without an envelope still appear in the actual monthly review. |
| Emergency reserve | A separate planned amount for each month. It reduces planning availability without recording a bank payment. |
| Recurring charges | Manually add or confirm detected monthly expenses, edit their terms and effective dates, deactivate or reactivate them, and retain activity-period snapshots. |
| Recurring detection | Expense-only monthly suggestions based on title, account, amount, and timing. Distinct series can share the same title. Suggestions require user confirmation. |
| Payment reconciliation | Conservatively match actual payments to recurring charges, and let users confirm uncertain candidates. Matched payments are excluded from variable-envelope consumption, not from real expenses. |
| Account history | Reconstruct individual or combined EUR account balances from recorded openings and the complete available transaction history, in a deterministic order. |
| Interactive history | A sticky balance panel follows the visible transaction, with a subtle active-row highlight, keyboard navigation, and reduced-motion support. Filters do not rebuild balances from a partial history. |

## Financial Business Rules

- `INCOME` adds to an account; `EXPENSE` subtracts from it. `TRANSFER` moves money between accounts and is excluded from income/expense totals.
- Transfers inside a selected account scope cancel out. Transfers leaving that scope, including transfers to excluded savings accounts, reduce its balance; incoming transfers increase it.
- **Monthly result** means actual income minus all actual expenses. **Account balance** also includes recorded opening balances and transfers across the selected scope.
- Historical balances use all available movements before display filters, ordered by transaction date, creation time, then ID. The application does not reconstruct missing bank history or certify an opening reference date.
- Planning uses `availableForBudgets = monthlyIncome - recurringCommittedTotal - emergencyReserve`, then `freeMoney = availableForBudgets - variableBudgetAllocated`.
- A recurring charge is a forecast, never an automatic bank debit. For an applicable month, a reliably matched actual payment replaces that charge's forecast amount in the commitment total. It is not added a second time.
- Variable spending excludes reliably matched recurring payments. Unmatched or ambiguous payments remain actual variable expenses, even when they resemble subscriptions.
- Activity periods, inclusive effective dates, and stored price/account/day snapshots preserve historical applicability. `active` alone is not a historical filter.
- Negative results and balances remain visible. Budget, reconciliation, and account-history helpers calculate in integer cents; storage is still mixed `Float`/`Decimal`, and older dashboard aggregates still use floating-point numbers.

See [Financial Business Rules](docs/business-rules.md) for formulas, matching criteria, date handling, and precision limits.

## Tech Stack

Versions below are the declarations in [`frontend/package.json`](frontend/package.json), not claims about the latest upstream releases. `npm ci` uses the committed lockfile.

| Layer | Dependency | Declared version |
| --- | --- | --- |
| Full-stack framework | Next.js, App Router | `16.2.6` |
| UI | React / React DOM | `19.2.4` |
| Language | TypeScript, strict mode | `^5` (lockfile: `5.9.3`) |
| Styling | Tailwind CSS / PostCSS integration | `^4` (Tailwind lockfile: `4.3.0`) |
| Components | shadcn/ui source components; `shadcn` tooling | `^4.7.0` |
| UI primitives and icons | `radix-ui` / `lucide-react` | `^1.4.3` / `^1.16.0` |
| Authentication | Auth.js (`next-auth`) | `^5.0.0-beta.31` |
| ORM tooling | `prisma` | `^7.8.0` |
| ORM client | `@prisma/client` | `^7.10.0` |
| PostgreSQL driver | `@prisma/adapter-pg` / `pg` | `^7.8.0` / `^8.21.0` |
| Validation | Zod | `^4.4.3` |
| Forms | React Hook Form / resolvers | `^7.80.0` / `^5.4.0` |
| Charts | Recharts | `^3.8.0` |
| Password hashing | bcryptjs | `^3.0.3` |
| Database | PostgreSQL | Server version not pinned in the repository |
| Tests | Node.js built-in test runner | `.test.mjs` files; no separate test framework |

shadcn/ui components live in the repository; the tooling version is not a version number for each copied component. Prisma CLI and client versions currently differ; dependency alignment is a maintenance item, not a change made by this documentation update.

## Architecture

```text
React UI / Next.js App Router
          |
Next.js route handlers (app/api)
          |
Auth.js session + ownership checks + Zod validation
          |
Financial domain helpers (lib)
          |
Prisma Client + PostgreSQL adapter
          |
PostgreSQL
```

The directory named `frontend/` contains the entire application, including the API and database integration. There is no separate backend service to start. Server pages guard access; client components handle forms, filtering, charts, and refreshes. Financial calculations are shared through focused helpers in `lib/`.

### Project Structure

```text
.
|-- README.md
|-- docs/
|   |-- architecture.md
|   |-- database.md
|   |-- business-rules.md
|   |-- testing.md
|   `-- roadmap.md
`-- frontend/
    |-- app/
    |   |-- api/                 # Auth, registration, accounts, transactions,
    |   |                       # categories, budgets, dashboard, recurring operations
    |   |-- accounts/
    |   |-- budgets/
    |   |-- categories/
    |   |-- dashboard/
    |   |-- login/
    |   |-- signup/
    |   `-- transactions/
    |-- components/             # Feature UI and shadcn/ui primitives
    |-- hooks/                  # Responsive UI and active-transaction tracking
    |-- lib/                    # Accounts, budgets, recurring rules, validation, tests
    |-- prisma/
    |   |-- schema.prisma
    |   `-- migrations/
    |-- public/                 # Existing visual assets
    |-- auth.ts
    |-- prisma.config.ts
    |-- package.json
    `-- package-lock.json
```

Tests are colocated under `lib/` and `components/`. The generated Prisma client is ignored by Git and belongs in `frontend/lib/generated/prisma/`.

### Technical Documentation

- [Architecture and data flow](docs/architecture.md)
- [Database models and migrations](docs/database.md)
- [Financial business rules](docs/business-rules.md)
- [Testing and verification](docs/testing.md)
- [Roadmap and current limitations](docs/roadmap.md)

## Security

- Auth.js uses a credentials provider and JWT sessions. Passwords are hashed with bcryptjs; passwords are not returned in registration responses.
- Financial pages call `auth()` and redirect unauthenticated visitors to `/login`. Financial API handlers also authenticate requests independently.
- API handlers resolve the session email to a database user, then scope financial reads and ownership checks to that user's ID. Related accounts and categories are checked before financial writes.
- Zod validates financial resource payloads, including strict object schemas in CRUD workflows. Registration currently has basic required-field and duplicate-email checks rather than the same Zod validation layer.
- Database constraints and transactional writes protect key relationships and recurring-source uniqueness. These complement application authorization; they are not PostgreSQL row-level security.
- Configuration uses environment variables. `.env` files and the generated client are ignored by Git. Never commit connection strings, session secrets, personal financial exports, or unredacted screenshots.

This is not a claim of a security audit or production hardening. The repository does not implement bank connectivity, application-level rate limiting, email verification, or password recovery.

## Getting Started

### Prerequisites

- Git and npm.
- A compatible Node.js runtime. Node `22.12+` within the 22.x line satisfies the locked Prisma requirements; checks for this documentation used Node `22.14.0`.
- An accessible PostgreSQL database with permission to apply the supplied migrations.

Use a separate development database. PostgreSQL may be local, hosted, or containerized; the repository supplies no Dockerfile, Compose configuration, or database seed script. Docker is optional, not a project dependency.

### 1. Clone and Install

```bash
git clone https://github.com/RajaJulie/FinInsight.git
cd FinInsight/frontend
npm ci
```

### 2. Configure the Environment

Create `frontend/.env` locally, relative to the repository root, with your own values:

```dotenv
DATABASE_URL="<your PostgreSQL connection URI>"
AUTH_SECRET="<your generated session secret>"
```

These are placeholders, not working credentials. `DATABASE_URL` is used by `prisma.config.ts` and the runtime PostgreSQL adapter. Auth.js consumes `AUTH_SECRET`. A local secret can be generated with `openssl rand -base64 32`; keep its output private. Use your provider's required connection and TLS settings.

### 3. Apply Migrations and Generate the Client

From `frontend/`, against the intended development database:

```bash
npx prisma migrate deploy
npx prisma generate
```

`prisma.config.ts` selects `prisma/schema.prisma` and `prisma/migrations/`. Client generation outputs to `lib/generated/prisma/`.

For an existing populated database, review migration SQL, confirm the target, and back it up first: some migrations backfill or normalize legacy records. A database predating the migration baseline requires a separate baselining review. Do not reset an existing database or substitute schema-push commands for this installation sequence.

### 4. Run the Application

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Register through `/signup`, then log in through `/login`. Registration creates default categories and a primary account. No demo user or personal financial dataset is supplied.

For a production build, with configuration and client generation already completed:

```bash
npm run build
npm run start
```

The layout uses `next/font/google`; a fresh build may need access to Google's font endpoints. Deployment configuration and reverse-proxy hardening are outside the supplied local setup.

## Testing

Run from `frontend/`:

```bash
node --experimental-strip-types --test
npm run typecheck
npm run lint
```

The tests exercise financial helpers, route handlers with isolated authentication/Prisma mocks, and server-rendered component output. They do not require the personal PostgreSQL database. There is no `npm test` script or committed browser-test runner.

Local verification on **2026-10-30**, using Node **22.14.0**: **188 tests passed, 0 failed**, typecheck passed, and lint passed. An earlier developer-reported local `npm run build` also succeeded; it was not rerun for this documentation-only update. These are observations for a local revision, not permanent guarantees or CI badges. See [Testing](docs/testing.md) for scope and gaps.

## Screenshots

Screenshots will be added after a privacy review. No placeholder image links or fabricated captures are included.

- Dashboard
- Accounts
- Transactions and interactive balance history
- Budgets and actual monthly review
- Recurring charges and suggestions

## Roadmap

- **Implemented:** authenticated financial CRUD, accounts and transfers, category analysis, monthly variable budgets, emergency reserve, recurring charges, suggestions and confirmation, payment reconciliation, and interactive balance history.
- **In progress:** MVP refinement, verification of financial edge cases, and documentation. This is an ongoing development area, not a promise of additional shipped functionality.
- **Considered:** consistent decimal money storage, unified dashboard/date calculations, automated browser and database integration tests, transaction pagination, export, bank integrations, notifications, goals, advanced insights, and shared spaces.

Export buttons and shared-space previews are not working implementations of those features. The [detailed roadmap](docs/roadmap.md) separates current limitations from possible future work; no release dates are committed.

## Author

**Julie Rajaratnam — Fullstack Developer**
