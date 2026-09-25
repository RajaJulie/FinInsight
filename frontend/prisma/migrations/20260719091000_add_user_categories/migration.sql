CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD COLUMN "categoryId" TEXT;

CREATE UNIQUE INDEX "Category_userId_type_name_key"
ON "Category"("userId", "type", "name");

CREATE INDEX "Category_userId_type_idx" ON "Category"("userId", "type");
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

ALTER TABLE "Category"
ADD CONSTRAINT "Category_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create the default categories once for every existing user.
WITH defaults("name", "type", "icon", "color") AS (
    VALUES
        ('Alimentation', 'EXPENSE'::"TransactionType", 'utensils', '#f97316'),
        ('Logement', 'EXPENSE'::"TransactionType", 'house', '#8b5cf6'),
        ('Transport', 'EXPENSE'::"TransactionType", 'car', '#06b6d4'),
        ('Shopping', 'EXPENSE'::"TransactionType", 'shopping-bag', '#ec4899'),
        ('Loisirs', 'EXPENSE'::"TransactionType", 'gamepad', '#6366f1'),
        ('Santé', 'EXPENSE'::"TransactionType", 'heart-pulse', '#ef4444'),
        ('Abonnements', 'EXPENSE'::"TransactionType", 'repeat', '#a855f7'),
        ('Autres', 'EXPENSE'::"TransactionType", 'shapes', '#64748b'),
        ('Salaire', 'INCOME'::"TransactionType", 'wallet-cards', '#22c55e'),
        ('Prime', 'INCOME'::"TransactionType", 'sparkles', '#eab308'),
        ('Freelance', 'INCOME'::"TransactionType", 'briefcase', '#14b8a6'),
        ('Remboursement', 'INCOME'::"TransactionType", 'rotate-ccw', '#3b82f6'),
        ('Autres revenus', 'INCOME'::"TransactionType", 'circle-dollar-sign', '#10b981')
)
INSERT INTO "Category" (
    "id", "name", "type", "icon", "color", "isDefault", "userId", "createdAt", "updatedAt"
)
SELECT
    'cmig_' || md5(users."id" || defaults."type"::text || defaults."name"),
    defaults."name",
    defaults."type",
    defaults."icon",
    defaults."color",
    true,
    users."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" AS users
CROSS JOIN defaults
ON CONFLICT ("userId", "type", "name") DO NOTHING;

-- Preserve every legacy category that is already referenced by a transaction.
INSERT INTO "Category" (
    "id", "name", "type", "icon", "color", "isDefault", "userId", "createdAt", "updatedAt"
)
SELECT DISTINCT
    'cmig_' || md5(transactions."userId" || transactions."type"::text || btrim(transactions."category")),
    btrim(transactions."category"),
    transactions."type",
    'shapes',
    '#64748b',
    false,
    transactions."userId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Transaction" AS transactions
WHERE btrim(transactions."category") <> ''
ON CONFLICT ("userId", "type", "name") DO NOTHING;

-- Link existing transactions without removing the historical text column.
UPDATE "Transaction" AS transactions
SET "categoryId" = categories."id"
FROM "Category" AS categories
WHERE categories."userId" = transactions."userId"
  AND categories."type" = transactions."type"
  AND categories."name" = btrim(transactions."category")
  AND transactions."categoryId" IS NULL;
