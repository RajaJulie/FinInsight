# Database

[README](../README.md) | [Architecture](architecture.md) | [Business rules](business-rules.md) | [Testing](testing.md) | [Roadmap](roadmap.md)

## Configuration

The source of truth is [`frontend/prisma/schema.prisma`](../frontend/prisma/schema.prisma). PostgreSQL is the configured provider; the repository does not pin a PostgreSQL server version or ship a container configuration.

[`prisma.config.ts`](../frontend/prisma.config.ts) loads `DATABASE_URL` through `dotenv/config` and selects the schema and migrations. The `prisma-client` generator writes TypeScript client files to `frontend/lib/generated/prisma/`, which is ignored by Git. Runtime access uses `PrismaPg` from `@prisma/adapter-pg`, not a direct browser connection.

## Models and Relationships

| Model | Purpose and important fields | Relations / constraints |
| --- | --- | --- |
| `User` | Name, unique email, hashed password, creation timestamp. | Owns accounts, transactions, categories, budgets, recurring definitions, and monthly reserves. |
| `Account` | Name, type, opening balance, EUR currency in current validation, icon/color, active/archive status, primary flag. | Unique `(userId, name)`; source movements, incoming transfers, recurring definitions. No stored running balance or dated bank reference. |
| `Transaction` | Title, amount, `INCOME`/`EXPENSE`/`TRANSFER`, date, timestamps, legacy category text. | Owned by a user. Optional `categoryId`, source `accountId`, and `destinationAccountId`; indexed by user/date and foreign keys. |
| `Category` | User-defined name, type, icon/color, default flag. | Unique `(userId, type, name)`; referenced by transactions, budgets, and recurring definitions. |
| `Budget` | Variable-envelope amount, month, year. | Unique `(userId, categoryId, month, year)`; category and user required. No fixed/variable allocation-mode enum. |
| `MonthlyEmergencyReserve` | Planned monetary reserve for a month. | Unique `(userId, year, month)`; owned by a user. No transaction relation. |
| `RecurringTransaction` | Current title/amount, type, `MONTHLY` frequency, day 1-31, active flag, effective start/end, optional detection identity. | Required user/category/account; source links and activity periods. Only income/expense are accepted by its API schema, despite sharing the transaction enum. |
| `RecurringActivityPeriod` | Inclusive effective dates, historical amount, cancellation flag, optional account/day snapshots. | Child of a recurring definition. Snapshot `accountId` is a nullable string, not a Prisma relation or independent ownership boundary. |
| `RecurringTransactionSource` | A real transaction linked to a recurring definition, with creation timestamp. | Unique `transactionId` and unique `(recurringTransactionId, transactionId)`. Used for detection sources and explicitly confirmed payments. |

```text
User -> Account, Transaction, Category, Budget,
        MonthlyEmergencyReserve, RecurringTransaction
Account -> Transaction (source), Transaction (transfer destination)
Category -> Transaction, Budget, RecurringTransaction
Account -> RecurringTransaction
RecurringTransaction -> RecurringActivityPeriod
RecurringTransaction -> RecurringTransactionSource <- Transaction
```

The optional transaction foreign keys support older data and category-free transfers. Current transaction creation requires an owned active source account. A transfer requires a different owned active destination account and is stored as one row, with no category relation.

Auth.js uses JWT sessions; this schema has no Auth.js session, OAuth account, or verification-token tables. The finance `Account` model is not an OAuth account model.

## Monetary Storage

| Field | Prisma | PostgreSQL |
| --- | --- | --- |
| `Transaction.amount` | `Float` | `DOUBLE PRECISION` |
| `Account.initialBalance` | `Float` | `DOUBLE PRECISION` |
| `Budget.amount` | `Float` | `DOUBLE PRECISION` |
| `RecurringTransaction.amount` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` |
| `RecurringActivityPeriod.amount` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` |
| `MonthlyEmergencyReserve.amount` | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12,2)` |

Recurring writes construct `Prisma.Decimal`; decimal fields are serialized as JSON numbers for the current frontend. Cent-based helpers normalize each amount with `Math.round(Number(amount) * 100)` before addition/subtraction. This reduces accumulation drift in those workflows, but does not make `Float` storage exact or eliminate every floating-point path. Legacy dashboard aggregates still use numbers directly. See [Business Rules](business-rules.md#money-and-dates).

Dates are Prisma `DateTime`, mapped by the supplied migrations to PostgreSQL `TIMESTAMP(3)`. The application imposes civil-date conventions; there is no separate bank execution-order field, opening-reference date, or history-completeness flag.

## Integrity and Authorization Boundaries

- User-owned root records use cascading user relations. Account/category foreign keys use restrictive deletion behavior so referenced resources are not silently removed.
- Removing a recurring definition cascades its activity periods and source links, not the real transactions. Removing a transaction cascades its source links, not the recurring definition.
- API ownership checks enforce same-user account/category/transaction relationships. Foreign keys alone do not enforce cross-model user equality; there is no PostgreSQL row-level security policy in the supplied migrations.
- Source uniqueness prevents one transaction from being persistently attached to multiple recurring definitions. The payment endpoint additionally checks that a charge does not already have a persisted payment in that month, inside a serializable transaction. There is no charge/month unique column in the source table.
- The detection identity fields are indexed, not globally unique. Distinct recurring series can share normalized title, account, type, and amount; source continuity and timing matter.

## Migration History

There are 15 supplied migration directories, covering these stages:

| Stage | Migration directory names |
| --- | --- |
| Existing schema baseline | `20260719090000_baseline` |
| Categories and legacy normalization | `20260719091000_add_user_categories`, `20260722090000_merge_duplicate_other_categories` |
| Accounts and transfers | `20260723090000_add_manual_accounts`, `20260723120000_refine_account_types`, `20260723150000_add_internal_transfers` |
| Variable budgets | `20260724090000_add_monthly_budgets` |
| Recurring definitions and persistent sources | `20260929090000_add_recurring_transactions`, `20260930120000_add_recurring_detection_identity`, `20260930123000_prevent_duplicate_recurring_sources` |
| Effective dates and reserve | `20261002090000_add_recurring_transaction_period`, `20261006160000_add_monthly_emergency_reserve` |
| Decimal amounts and lifecycle history | `20261009090000_recurring_amount_decimal`, `20261010120000_add_recurring_activity_periods`, `20261010150000_snapshot_recurring_payment_schedule` |

Some guarantees exist in SQL beyond the Prisma model declarations:

- `Account_one_primary_per_user_key`: partial unique index for a user's primary account.
- `RecurringActivityPeriod_one_open_period_idx`: at most one non-cancelled open period per recurring definition.
- Activity date-order and optional day-of-month check constraints.

Migrations include data backfills and category normalization; they are not all schema-only. Installation on a new development database is documented in the [README](../README.md#getting-started). Review and back up an existing database before applying them. None were applied and no PostgreSQL data was queried or modified during this documentation update.
