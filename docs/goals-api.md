# Savings Goals API (Phase 3)

This backend manages virtual envelopes backed by existing accounts. It does not create bank transactions, debit accounts, transfer money, or change budgets/reserves. The phase-2 schema and migration are reused unchanged. No goals page or navigation change is included.

## Authentication and Responses

Every handler calls Auth.js `auth()`, resolves the session email to a stored user, and scopes goals, related accounts, and financial reads by that user. Client-supplied ownership fields are rejected. A missing session or unknown session user receives `401`. A missing or foreign goal/account receives the same `404` response.

| Endpoint | Result |
| --- | --- |
| `GET /api/goals` | `{ goals, accounts, asOf }`, including paused and archived goals. |
| `POST /api/goals` | `201`, `{ message, goal }`, no initial allocation. |
| `GET /api/goals/[id]` | `{ goal, asOf }`, including chronological `entries`. |
| `PATCH /api/goals/[id]` | `{ message, goal }`, preserving the journal. |
| `POST /api/goals/[id]/entries` | New entry: `201`; verified idempotent replay: `200`. Both return `{ message, replayed, entry, goal }`. |

Goal responses expose `id`, `title`, `accountId`, `account`, `targetAmount`, `targetDate`, `status`, `accumulatedAmount`, `remainingAmount`, `progressPercentage`, `excessAmount`, `reached`, timestamps, and `warnings`. Listing omits the full journal; detail and entry responses include it.

Each account view contains its identifying fields and `bankBalance`, `reservedAmount`, `unreservedAmount`, `underfunded`, `shortfallAmount`, `hasFutureEntries`, and `balanceVerified: false`. These are calculated from recorded data, not a bank-synchronized reference. Current account-balance semantics are reused, including all recorded bank movements, rather than introducing a second dated bank-balance formula.

Reads use a repeatable-read transaction for a consistent database snapshot. `asOf` is the application timestamp used to select effective goal entries. Future entries, if present from outside these APIs, are shown in history but excluded from current reservations. Any future entry on an account blocks new journal operations on that account pending a calendar review; no record is deleted or silently moved.

## Payloads and Validation

Create a goal:

```json
{
  "title": "A personal project",
  "accountId": "<owned-account-id>",
  "targetAmount": "1000.00",
  "targetDate": "2027-06-30"
}
```

`targetDate` may be omitted or `null`; dates use a valid `YYYY-MM-DD` civil date normalized to UTC midnight. A past target date remains valid for an overdue goal. Titles are trimmed, required, and limited to 120 characters. Creating a goal requires an active, owned EUR account; no bank-name/type list is hardcoded.

PATCH accepts only `title`, `targetAmount`, `targetDate`, `status`, and `accountId`. It must contain at least one field. `targetDate: null` clears the date. Account changes require a completely empty journal, not merely a zero accumulated amount, and an eligible destination account. A same-account update does not count as a move.

Create a journal entry:

```json
{
  "type": "ALLOCATION",
  "amount": "25.00",
  "idempotencyKey": "<client-generated-operation-key>",
  "note": "Optional note"
}
```

Monetary values may be JSON numbers or decimal strings, must be strictly positive, finite, at most two decimal places, and fit `Decimal(12,2)`. Existing pure money helpers validate them without silently rounding. The key is trimmed, required, and limited to 128 characters; notes are trimmed, limited to 1000 characters, and blank/omitted notes become `null`.

Entries are immediate operations: `effectiveAt` is assigned by the server after locks are acquired. Backdated/future entry payloads, user IDs, bank transaction IDs, calculated balances, and other unknown fields are rejected by strict Zod schemas. Journal entries cannot be edited or deleted through these endpoints.

## Status Rules

| Current status | Allowed next statuses |
| --- | --- |
| `ACTIVE` | `ACTIVE`, `PAUSED`, `ARCHIVED` |
| `PAUSED` | `PAUSED`, `ACTIVE`, `ARCHIVED` |
| `ARCHIVED` | `ARCHIVED`, `ACTIVE` (explicit restoration) |

Restoration/activation requires an eligible account. An archived goal cannot move directly to paused. Metadata corrections on an archived goal are allowed, without changing its entries. Achieved status remains derived from the accumulated amount, not stored as another lifecycle state.

ALLOCATION requires an active goal and active owned EUR account. All goal reservations on that account count, including paused, archived, and reached goals. RELEASE is allowed on active, paused, and archived goals, including when the associated account has been archived, so virtual funds are not trapped. A release can never exceed the accumulated amount. Archiving and pausing do not release funds.

## Concurrency Protocol

All goal writes go through one bounded-retry transaction helper:

1. For an existing goal, read its account, lock the owned account row with parameterized `SELECT ... FOR UPDATE`, then reread the goal. If it moved before the lock was obtained, restart the transaction. Account moves lock both old and new accounts in sorted ID order.
2. For a new journal operation, check the existing idempotency record under the account lock before applying status or funding rules.
3. Lock existing owned bank movements referencing that account with `SELECT ... ORDER BY id FOR SHARE`, then read fresh account/goal data and apply the phase-2 helpers.
4. Insert only the `GoalEntry` and commit. Account locks remain held until commit/rollback. All goal metadata/account moves use the same per-account coordination.

Write transactions use **READ COMMITTED intentionally**, not a serializable transaction begun with a potentially stale pre-lock snapshot. Serialization comes from explicit account locks; subsequent queries observe prior committed reservations after acquiring those locks. The additional bank-row locks prevent existing amount updates/deletes during funding checks. The account row lock also conflicts with foreign-key key-share locks used by new bank movements. Account opening/status edits likewise conflict with that account lock.

The protocol is based on PostgreSQL's documented [row lock conflicts](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS), [read-committed statement snapshots](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED), and [foreign-key checks in PostgreSQL source](https://doxygen.postgresql.org/ri__triggers_8c_source.html). This reasoning is not a substitute for running the integration tests on the deployed PostgreSQL version.

The helper retries the whole transaction up to three total attempts for `P2034`, SQLSTATE `40001`/`40P01`, a changed account snapshot, or a unique conflict. Short bounded delays occur outside the aborted transaction. Prisma/adapter-wrapped codes are recognized. Lock/transaction timeouts and exhausted conflicts return `409 CONCURRENT_CHANGE`; no partial operation is reported as success.

### Idempotency

The existing unique `(goalId, idempotencyKey)` constraint is the final database backstop. A repeated key succeeds only after rereading the persisted row and comparing normalized type, exact cent amount, and normalized note. Same operation: return its original entry with `200`, even if funds/status changed later. Different operation: `409 IDEMPOTENCY_CONFLICT`.

A unique-constraint error alone is never considered success. Retrying opens a fresh transaction and performs the same stored-operation comparison. Server-assigned timestamps are not client payload fields and are not regenerated on replay. The returned goal/funding view is current; the replayed entry is the original one.

## Errors

Errors follow `{ message, code }`; validation failures also contain Zod's flattened `errors`.

| Status | Examples |
| --- | --- |
| `400` | Malformed JSON, invalid/unknown fields, invalid amount/date, unsupported account currency. |
| `401` | Missing authentication or unknown session user. |
| `404` | Goal/account absent, foreign-owned, or goal with an inaccessible account. |
| `409` | Archived account for allocation, inactive goal, insufficient free funds, excessive release, account move with history, invalid status transition, conflicting key, future entries, exhausted concurrency retries. |
| `500` | Unexpected infrastructure error or inconsistent stored monetary data. Internal SQL, private values, and raw exception messages are not returned. |

No endpoint automatically repairs inconsistent historical journals or manufactures balancing entries.

## Tests and Remaining Limits

`frontend/lib/goals/api.test.mjs` executes the real route handlers/services with isolated Auth.js/Prisma mocks and forbidden financial-write methods. Its mutex simulates account serialization; retry and unique-conflict cases are injected. These are unit/contract tests, **not evidence of real PostgreSQL concurrency**.

`frontend/lib/goals/postgres.integration.test.mjs` is opt-in and never falls back to `DATABASE_URL` or loads `.env`. It requires `FININSIGHT_GOALS_TEST_DATABASE_URL` pointing to a dedicated test database whose name includes a separate `test` segment. Only after explicit authorization, run from `frontend/` with that variable configured:

```bash
node --experimental-strip-types --test lib/goals/postgres.integration.test.mjs
```

The integration suite creates a random isolated schema, minimal financial fixture tables, and the existing goals schema there. It exercises real Prisma service calls for concurrent allocations, duplicate keys, releases, and PostgreSQL bank-lock conflicts. Cleanup drops only that newly created random test schema. Never set this variable to a personal or production database. No migrations are run against the application's schema. Without the variable, the suite is skipped and no PostgreSQL connection is opened.

Remaining boundaries:

- A goal reservation is virtual. Bank activity after commit can reduce coverage; the read APIs expose the deficit without rewriting goals or blocking subsequent real-life spending.
- The locking protocol assumes normal PostgreSQL foreign-key enforcement and all application goal writes going through this service. Arbitrary SQL, disabled constraints, or new writers bypassing the protocol are outside its guarantees.
- Bank history rows are locked briefly for writes; large histories can increase latency and contention. Deadlocks with existing bank workflows remain possible and are bounded/retried, not claimed impossible.
- Legacy account deletion currently checks transactions/recurrences, not goals. The existing restrictive FK prevents loss of linked goals, but that endpoint can return a generic `500` instead of `409`. Its UX/error adaptation requires a separate scoped change; no existing bank route was modified here.
- No full bank verification, bank import, background execution, historical entry editing, HTTP browser session integration, or goals UI is added.
