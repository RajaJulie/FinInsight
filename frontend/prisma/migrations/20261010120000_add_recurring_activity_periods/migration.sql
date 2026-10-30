BEGIN;

CREATE TABLE "RecurringActivityPeriod" (
  "id" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "amount" DECIMAL(12,2) NOT NULL,
  "cancelled" BOOLEAN NOT NULL DEFAULT false,
  "recurringTransactionId" TEXT NOT NULL,
  CONSTRAINT "RecurringActivityPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecurringActivityPeriod_dates_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate")
);

CREATE INDEX "RecurringActivityPeriod_recurringTransactionId_startDate_idx"
  ON "RecurringActivityPeriod"("recurringTransactionId", "startDate");

CREATE UNIQUE INDEX "RecurringActivityPeriod_one_open_period_idx"
  ON "RecurringActivityPeriod"("recurringTransactionId")
  WHERE "endDate" IS NULL AND "cancelled" = false;

ALTER TABLE "RecurringActivityPeriod"
  ADD CONSTRAINT "RecurringActivityPeriod_recurringTransactionId_fkey"
  FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
