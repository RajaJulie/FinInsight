ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

ALTER TABLE "Transaction"
ADD COLUMN "destinationAccountId" TEXT;

CREATE INDEX "Transaction_destinationAccountId_idx"
ON "Transaction"("destinationAccountId");

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_destinationAccountId_fkey"
FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
