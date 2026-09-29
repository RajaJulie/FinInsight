CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY');

CREATE TABLE "RecurringTransaction" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "TransactionType" NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL DEFAULT 'MONTHLY',
    "dayOfMonth" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecurringTransaction_type_check" CHECK ("type" IN ('INCOME', 'EXPENSE')),
    CONSTRAINT "RecurringTransaction_dayOfMonth_check" CHECK ("dayOfMonth" BETWEEN 1 AND 31)
);

CREATE INDEX "RecurringTransaction_userId_active_idx"
ON "RecurringTransaction"("userId", "active");

CREATE INDEX "RecurringTransaction_userId_frequency_idx"
ON "RecurringTransaction"("userId", "frequency");

CREATE INDEX "RecurringTransaction_categoryId_idx"
ON "RecurringTransaction"("categoryId");

CREATE INDEX "RecurringTransaction_accountId_idx"
ON "RecurringTransaction"("accountId");

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
ADD CONSTRAINT "RecurringTransaction_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
