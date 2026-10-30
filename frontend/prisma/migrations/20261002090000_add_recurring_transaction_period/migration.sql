-- Add a business period to existing recurring transactions without deleting data.
-- startDate is backfilled from the first confirmed source transaction when possible.
-- Manual recurring transactions without source history fall back to their creation day.

ALTER TABLE "RecurringTransaction"
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "endDate" TIMESTAMP(3);

WITH first_sources AS (
    SELECT
        sources."recurringTransactionId",
        date_trunc('day', MIN(transactions."date")) AS "startDate"
    FROM "RecurringTransactionSource" AS sources
    INNER JOIN "Transaction" AS transactions
        ON transactions."id" = sources."transactionId"
    GROUP BY sources."recurringTransactionId"
)
UPDATE "RecurringTransaction" AS recurring
SET "startDate" = first_sources."startDate"
FROM first_sources
WHERE recurring."id" = first_sources."recurringTransactionId"
  AND recurring."startDate" IS NULL;

UPDATE "RecurringTransaction"
SET "startDate" = date_trunc('day', "createdAt")
WHERE "startDate" IS NULL;

UPDATE "RecurringTransaction"
SET "endDate" = date_trunc('day', "updatedAt")
WHERE "active" = false
  AND "endDate" IS NULL;

ALTER TABLE "RecurringTransaction"
ALTER COLUMN "startDate" SET NOT NULL;

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_period_check"
CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

CREATE INDEX "RecurringTransaction_categoryId_startDate_endDate_idx"
ON "RecurringTransaction"("categoryId", "startDate", "endDate");
