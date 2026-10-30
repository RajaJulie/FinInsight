# Roadmap and Current Limitations

[README](../README.md) | [Architecture](architecture.md) | [Database](database.md) | [Business rules](business-rules.md) | [Testing](testing.md)

This roadmap distinguishes code that exists from maintenance work and possible product directions. It is not a release schedule. New financial rules, migrations, or integrations require separate design and validation.

## Implemented MVP

- Credentials authentication, protected financial pages, user-scoped financial CRUD, and Zod validation for financial resources.
- Manual EUR accounts, primary/archive management, internal transfers, account-to-history links, and category analysis.
- User-wide monthly variable planning, emergency reserves, negative allocation visibility, and actual spending by category even without an envelope.
- Manual monthly expense definitions and detected suggestions, independent series confirmation, technical source identity, activity periods, editing, activation, and reactivation.
- Conservative computed payment matching and explicit confirmation of uncertain payments, without synthesizing bank transactions.
- Individual/combined recorded balance histories and an accessible sticky active-transaction balance panel.
- Colocated domain, mocked-handler, and component presentation regression tests.

"Implemented" means present in the reviewed code, not bank certification, complete test coverage, or production hardening.

## Current Development Focus

MVP refinement and financial edge-case verification remain ongoing. This documentation update describes those workflows and limits; it does not implement new financial behavior. No additional product feature is designated as actively shipping without a corresponding implementation.

## Prioritized Technical Follow-Ups

1. **Money consistency:** plan an audited conversion of remaining `Float` monetary fields, share cent/decimal calculations with older dashboard aggregates, and align Prisma CLI/client/adapter versions. Any data migration must be separately approved and tested without resetting data.
2. **Dates and history completeness:** unify UTC/civil-month policies across dashboard, categories, and budgets; design a dated opening reference and completeness indicator before labeling a balance bank-verified.
3. **Verification:** add CI, reproducible browser tests, and isolated PostgreSQL integration/concurrency tests. Current mocked handlers and rendered markup are not substitutes for those layers.
4. **Scale and API semantics:** profile recursive recurring-sequence selection; design paginated/virtualized history while preserving complete-history balances; move legacy normalization out of GET workflows where appropriate.
5. **Security and polish:** strengthen registration validation, assess rate limiting, recovery/verification flows, deployment settings, consistent localization, and remaining placeholder UI.

These are recommendations, not changes applied by the documentation task or promises of delivery.

## Product Ideas Not Yet Implemented

| Idea | Current evidence / boundary |
| --- | --- |
| Bank connections and synchronization | Accounts are manually entered. `BankConnections` displays owned accounts, not an external banking integration. |
| Transaction/data export | An export button exists, but the transaction page supplies no export handler or export endpoint. |
| Notifications and reminders | Menu labels do not implement delivery, scheduling, or recurring-payment reminders. |
| Shared financial spaces | The accounts page contains a marked preview and disabled creation action, not membership or permission workflows. |
| Financial goals | Navigation placeholder; no goals page/model/API. |
| Advanced insights | A rule-based monthly spending message exists; this is not a dedicated insights product or predictive engine. |
| Other currencies and recurring frequencies | Current account validation accepts EUR; recurring frequency is `MONTHLY`. No FX conversion, weekly, or yearly scheduling. |

## Known Boundaries

- There is no automatic bank debit, ledger generation from a schedule, or verified banking reconciliation feed.
- The entire transaction list is fetched client-side. There is no transaction pagination, import pipeline, or committed browser-test runner.
- Detection is heuristic. Its count-based confidence, tolerances, single-date outlier rule, and missing-month allowance can produce false positives/negatives; users confirm suggestions and uncertain payments.
- Reliable matching and category-based variable spending do not establish that imported history is complete. Account openings have no bank reference date.
- Planning and actual review are user-wide; selected-scope bank balances have separate semantics. Older dashboard date and numeric code has not been fully unified with those helpers.
- Some screens remain dark-styled even though shared components contain theme tokens; full light-theme and localization polish is not claimed.
- No license file or deployment configuration is supplied. Publication/license policy and deployment readiness need explicit decisions; a public repository alone is not a deployment or security guarantee.

Screenshots are pending privacy review. Only sanitized, real application captures should be added to the root README.
