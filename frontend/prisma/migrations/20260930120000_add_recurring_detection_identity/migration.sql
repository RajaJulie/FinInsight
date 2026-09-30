ALTER TABLE "RecurringTransaction"
ADD COLUMN "detectionTitleNorm" TEXT,
ADD COLUMN "detectionAccountId" TEXT,
ADD COLUMN "detectionType" "TransactionType";

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_detectionType_check"
CHECK ("detectionType" IS NULL OR "detectionType" IN ('INCOME', 'EXPENSE'));

CREATE TABLE "RecurringTransactionSource" (
    "id" TEXT NOT NULL,
    "recurringTransactionId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringTransactionSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringTransaction_detectionType_detectionTitleNorm_detectionAccountId_idx"
ON "RecurringTransaction"("detectionType", "detectionTitleNorm", "detectionAccountId");

CREATE UNIQUE INDEX "RecurringTransactionSource_recurringTransactionId_transactionId_key"
ON "RecurringTransactionSource"("recurringTransactionId", "transactionId");

CREATE INDEX "RecurringTransactionSource_transactionId_idx"
ON "RecurringTransactionSource"("transactionId");

ALTER TABLE "RecurringTransactionSource"
ADD CONSTRAINT "RecurringTransactionSource_recurringTransactionId_fkey"
FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTransactionSource"
ADD CONSTRAINT "RecurringTransactionSource_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
