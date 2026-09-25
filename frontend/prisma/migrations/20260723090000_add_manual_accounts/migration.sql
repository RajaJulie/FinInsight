CREATE TYPE "AccountType" AS ENUM (
    'CHECKING',
    'SAVINGS',
    'PASSBOOK',
    'CASH',
    'JOINT',
    'CREDIT_CARD',
    'OTHER'
);

CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD COLUMN "accountId" TEXT;

CREATE UNIQUE INDEX "Account_userId_name_key"
ON "Account"("userId", "name");

CREATE UNIQUE INDEX "Account_one_primary_per_user_key"
ON "Account"("userId")
WHERE "isPrimary" = true;

CREATE INDEX "Account_userId_status_idx"
ON "Account"("userId", "status");

CREATE INDEX "Transaction_accountId_idx"
ON "Transaction"("accountId");

ALTER TABLE "Account"
ADD CONSTRAINT "Account_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create one manual default account for every existing user.
INSERT INTO "Account" (
    "id",
    "name",
    "type",
    "initialBalance",
    "currency",
    "icon",
    "color",
    "status",
    "isPrimary",
    "userId",
    "createdAt",
    "updatedAt"
)
SELECT
    'cacc_' || md5(users."id" || 'Compte principal'),
    'Compte principal',
    'CHECKING'::"AccountType",
    0,
    'EUR',
    'wallet',
    '#8b5cf6',
    'ACTIVE'::"AccountStatus",
    true,
    users."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" AS users
ON CONFLICT ("userId", "name") DO NOTHING;

-- Preserve every existing transaction by linking it to its owner's default account.
UPDATE "Transaction" AS transactions
SET "accountId" = accounts."id"
FROM "Account" AS accounts
WHERE accounts."userId" = transactions."userId"
  AND accounts."isPrimary" = true
  AND transactions."accountId" IS NULL;
