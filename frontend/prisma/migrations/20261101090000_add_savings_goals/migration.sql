BEGIN;

CREATE TYPE "SavingsGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "GoalEntryType" AS ENUM ('ALLOCATION', 'RELEASE');

CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" "SavingsGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SavingsGoal_title_check" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "SavingsGoal_targetAmount_check" CHECK ("targetAmount" > 0 AND "targetAmount" <= 9999999999.99)
);

CREATE TABLE "GoalEntry" (
    "id" TEXT NOT NULL,
    "type" "GoalEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GoalEntry_amount_check" CHECK ("amount" > 0 AND "amount" <= 9999999999.99),
    CONSTRAINT "GoalEntry_idempotencyKey_check" CHECK (length(btrim("idempotencyKey")) > 0)
);

CREATE INDEX "SavingsGoal_userId_status_idx" ON "SavingsGoal"("userId", "status");
CREATE INDEX "SavingsGoal_accountId_idx" ON "SavingsGoal"("accountId");
CREATE INDEX "GoalEntry_goalId_effectiveAt_idx" ON "GoalEntry"("goalId", "effectiveAt");
CREATE UNIQUE INDEX "GoalEntry_goalId_idempotencyKey_key" ON "GoalEntry"("goalId", "idempotencyKey");

ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoalEntry" ADD CONSTRAINT "GoalEntry_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
