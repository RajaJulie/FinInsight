BEGIN;

ALTER TABLE "RecurringActivityPeriod"
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "dayOfMonth" INTEGER;

ALTER TABLE "RecurringActivityPeriod"
  ADD CONSTRAINT "RecurringActivityPeriod_day_check"
  CHECK ("dayOfMonth" IS NULL OR "dayOfMonth" BETWEEN 1 AND 31);

COMMIT;
