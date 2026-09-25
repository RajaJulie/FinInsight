-- Replace product-oriented account types with stable financial families.
ALTER TYPE "AccountType" RENAME TO "AccountType_old";

CREATE TYPE "AccountType" AS ENUM (
    'CHECKING',
    'SAVINGS',
    'CASH',
    'INVESTMENT',
    'CREDIT',
    'OTHER'
);

ALTER TABLE "Account"
ALTER COLUMN "type" TYPE "AccountType"
USING (
    CASE "type"::TEXT
        WHEN 'PASSBOOK' THEN 'SAVINGS'
        WHEN 'JOINT' THEN 'CHECKING'
        WHEN 'CREDIT_CARD' THEN 'CREDIT'
        ELSE "type"::TEXT
    END
)::"AccountType";

DROP TYPE "AccountType_old";
