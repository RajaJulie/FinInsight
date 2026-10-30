# Financial Business Rules

[README](../README.md) | [Architecture](architecture.md) | [Database](database.md) | [Testing](testing.md) | [Roadmap](roadmap.md)

This document describes the current implementation, including its limits. A planned amount, an actual payment, a monthly result, and a reconstructed account balance are different concepts.

## Actual Movements and Account Scopes

Transactions store positive amounts; their type supplies the direction:

- `INCOME`: increases the source account balance and actual income.
- `EXPENSE`: decreases the source account balance and actual expenses.
- `TRANSFER`: subtracts from the source account and adds to the destination, without becoming income or an expense.

Transfers are one row, not separate incoming and outgoing transactions. The current routes require distinct owned active accounts for creation. For a selected account scope:

```text
transfer movement = amount if destination is selected
                  - amount if source is selected
```

Both accounts selected means zero net movement. Leaving the scope reduces it; entering it increases it. A transfer to an excluded savings/investment account reduces current-account availability without changing the monthly financial result.

[`lib/accounts/balance.ts`](../frontend/lib/accounts/balance.ts) supplies these signed movements. The default combined scope is active EUR `CHECKING` and `CASH` accounts, not a hardcoded pair of bank names. Explicit individual selections may include archived or savings accounts. The transaction screen also offers all owned EUR accounts. No currency conversion is implemented.

## Historical Balances and Monthly Results

[`buildAccountBalanceHistory()`](../frontend/lib/accounts/history.ts) deduplicates transaction IDs, sorts the complete available history, starts from selected accounts' recorded opening balances, and applies movements in cents.

Order is deterministic: transaction date ascending, creation timestamp ascending, then ID ascending. The creation timestamp falls back to the transaction date if absent. Display order may be reversed, but the financial replay is not. An ID tie-breaker is a technical convention, not proof of bank execution order.

```text
monthly result = actual income - actual expenses
closing account balance = opening account balance
                        + actual income - actual expenses
                        + transfers into scope - transfers out of scope
```

The same real expense is included once whether or not it is reconciled as recurring. Envelopes, unpaid forecasts, and planned reserves are not bank movements.

The account summary uses the last movement before the month as its opening balance. If none exists, it exposes the recorded opening only when the first available movement is at or before the month boundary; otherwise opening is `null`. Closing is `null` if no scoped movement exists before the next month. Empty months after recorded history retain the previous balance.

`Account` has no dated opening reference or completeness marker. Consequently `bankBalance` remains `null`; `openingBalance` and `closingBalance` are calculated from available records and displayed as unverified. Separate cumulative-result fields in `cumulative-result.ts` sum income minus expenses, excluding transfers and opening balances. They must not be relabeled as a verified bank balance.

The transaction screen calculates balances **before** search, type, category, or partial-date filtering, for the chosen account scope. Its sticky panel only selects an existing balance by transaction ID; scrolling and filtering do not replay an incomplete subset.

## Monthly Planning

[`getMonthlyBudgetActivity()`](../frontend/lib/budgets/monthly-activity.ts) and [`calculateBudgetSummary()`](../frontend/lib/budgets/summary.ts) provide:

```text
availableForBudgets = monthlyIncome
                    - recurringCommittedTotal
                    - emergencyReserve

freeMoney = availableForBudgets - variableBudgetAllocated
```

- `monthlyIncome` is actual user-owned `INCOME` within the selected month, not recurring income forecasts.
- `recurringCommittedTotal` includes applicable monthly expense definitions, manually created or confirmed from detection. For a charge with reliable payments in that month, its matched actual total replaces its forecast. Otherwise the forecast is retained.
- `emergencyReserve` is a planned monthly allocation, defaulting to zero when absent. It is not a savings transfer or actual expense.
- `variableBudgetAllocated` sums the month's envelope amounts. A budget is a variable envelope only; there is no `BudgetAllocationMode` field.
- `freeMoney` is returned by the API. The frontend must not substitute a second allocation formula or clamp negative values.

For each category with an envelope:

```text
variable spending = actual category EXPENSE payments not reliably reconciled
envelope remaining = envelope amount - variable spending
```

The summary `spent` covers categories with allocated envelopes, not necessarily all user expenses. The actual monthly review below covers categories without envelopes as well. A negative envelope means overspending; negative `freeMoney` means overallocation. Neither deletes or adjusts existing envelopes.

## Actual Monthly Review

[`calculateMonthlyActualSummary()`](../frontend/lib/budgets/actual-summary.ts) partitions unique real monthly transactions:

```text
remaining after paid charges = actual income - recurring payments actually paid
other expenses = all actual EXPENSE payments not reliably matched
total actual expenses = paid recurring payments + other expenses
monthly result = actual income - total actual expenses
```

Other expenses are grouped by category relation, with legacy text or an uncategorized fallback. Categories do not need an allocated budget. Transfers are excluded. An unpaid recurring forecast does not reduce this result. Matching changes the expense partition, not the total actual expenditure.

The user-wide actual review and planning values are distinct from the selectable account-scope balance breakdown on `/budgets`.

## Recurring Definitions and Activity

[`activity-periods.ts`](../frontend/lib/recurring/activity-periods.ts) uses non-cancelled activity snapshots when present, or the definition's effective dates/amount for legacy definitions. It does not discard all past activity because `active` is false.

- Effective start and end days are inclusive. A monthly forecast applies when an activity period overlaps that calendar month; it is not prorated and does not require the scheduled debit day to fall inside the overlap.
- If multiple periods overlap a month, the latest applicable period supplies its forecast once. A same-month restart does not reserve the same charge twice.
- Deactivation closes the applicable period at the action day or an earlier valid supplied end, preserving previous months. A future period can be cancelled before it starts.
- Reactivation creates a new period no earlier than today, the original start, and the day after closed periods. It does not fill inactive gaps. Unknown legacy termination history can block reactivation until corrected.
- Editing active price/account/day terms can split a period at the start of the current month, retaining previous months' snapshots. Closed amounts are not silently overwritten.
- Historical date corrections require `confirmPeriodCorrection` and reject invalid/overlapping periods. They intentionally recalculate affected months; history is preserved against accidental edits, not made immutable against an explicit correction.
- The last persisted real payment date is not the subscription's contractual end. Editing an end date never deletes that payment.

See [`activity-transition.ts`](../frontend/lib/recurring/activity-transition.ts) and [`update.ts`](../frontend/lib/recurring/update.ts). Current UI workflows manage expense charges; the generic CRUD schema also accepts recurring income, which is not used as received income in budgets. Frequency is monthly only.

## Detection and Confirmation

[`detection.ts`](../frontend/lib/recurring/detection.ts) is a heuristic, not a bank-provided subscription registry or an ML model:

- Only actual `EXPENSE` rows are candidates; income and transfers are excluded.
- Titles are normalized with Unicode NFKC, trimming, lowercasing, and whitespace collapsing. Account and type separate candidate groups.
- Minimum two occurrences: two produce `POSSIBLE`; three or more produce `HIGH`. Confidence is an occurrence-count label, not a probability.
- Amount coherence normally requires every amount to lie within `max(0.02 EUR, min(5 EUR, 10% of the mean))`. With three or more occurrences, one initial amount may use a 25%-of-later-mean allowance capped at 5 EUR, with the same minimum tolerance.
- Timing normally allows four days around an estimated day. At three or more occurrences, a single date outlier may be tolerated. At most one calendar month may be missing in a sequence; any adjacent month-index gap is at most two. A missing-month sequence also requires at least three occurrences and a coherent consecutive-month pair. The post-gap date is not independently required to match the earlier usual day: this is a deliberate MVP heuristic limit.
- Non-overlapping series are selected so a transaction is not reused between suggested series. Estimated amount is the rounded mean; estimated day is the rounded mean of UTC day numbers.

Confirmation recomputes current suggestions, validates ownership, and records technical identity (`detectionTitleNorm`, `detectionAccountId`, `detectionType`) plus source links. User-facing title edits do not rewrite historic transactions or discard the technical identity. Source uniqueness and transactional insertion prevent duplicate confirmation of the same payments.

Manual definitions do not require historical sources. Exact manual duplicates are checked using normalized identity, account, type, amount, frequency, scheduled day, and overlapping effective dates, in a serializable transaction. Existing definitions suppress only compatible, unambiguous detected payments; a similar name alone does not merge series. Detection suppression has its own small amount tolerance and is not equivalent to reliable payment reconciliation.

"Not now" hides only that suggestion ID in React state. It performs no write and is not persisted in local storage.

## Payment Reconciliation

[`reconciliation.ts`](../frontend/lib/recurring/reconciliation.ts) first considers persisted source links, then conservative computed matches. Applicable expense type, monthly frequency, activity dates, and the account effective for that date are required. A valid persisted link is an explicit association: it does not additionally require the old amount or user-facing title to remain equal.

Without a link, automatic matching requires normalized title, exact cent amount, and a day within four days of the scheduled day (clamped to month-end). Exactly one charge and one strict payment contender for that charge/month are needed. Ambiguity or a changed amount remains pending and variable until confirmed. Category equality alone never identifies a recurring payment.

The payment-confirmation endpoint checks ownership, expense type, applicable dates/account, transaction uniqueness, and an existing payment for the same charge/month. Explicit confirmation can accept a changed amount. It creates a source link only, in a serializable transaction; it does not update transaction amounts or balances. Computed automatic matches are read-only and do not themselves persist links.

Every actual transaction ID contributes at most once to the monthly partition. Existing valid source associations may contain multiple historic payments in a month; those unique real amounts are summed, not discarded or synthesized.

## Money and Dates

Budget and historical-account calculations use integer cents after `Math.round(Number(amount) * 100)`, then expose JSON numbers in euros. Recurring definitions, snapshots, and reserves use PostgreSQL `DECIMAL(12,2)`; transactions, envelopes, and account openings still use floating-point storage. Integer-cent arithmetic is not a claim of arbitrary precision or complete decimal storage. Dashboard summary/chart handlers still aggregate floating numbers directly.

Budget months and category analytics use UTC `[start of month, start of next month)` boundaries. Recurring form dates use validated `YYYY-MM-DD` values normalized to UTC midnight. Activation actions determine today's civil date in `Europe/Paris`. The transaction date filter compares UTC date components for `day`, `day/month`, or `day/month/year`; impossible inputs safely match nothing. Older dashboard summary/chart handlers use server-local calendar boundaries, so date-policy consistency remains a limitation.

Formatting with `Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })` is presentation, not financial correction. No helper is intended to invent balancing adjustments, missing transactions, or bank-verified history.
