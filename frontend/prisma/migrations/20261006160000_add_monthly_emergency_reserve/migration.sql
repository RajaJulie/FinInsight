CREATE TABLE "MonthlyEmergencyReserve" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyEmergencyReserve_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MonthlyEmergencyReserve_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "MonthlyEmergencyReserve_month_check" CHECK ("month" BETWEEN 1 AND 12),
    CONSTRAINT "MonthlyEmergencyReserve_year_check" CHECK ("year" BETWEEN 1 AND 9999)
);

CREATE UNIQUE INDEX "MonthlyEmergencyReserve_userId_year_month_key"
ON "MonthlyEmergencyReserve"("userId", "year", "month");

ALTER TABLE "MonthlyEmergencyReserve"
ADD CONSTRAINT "MonthlyEmergencyReserve_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
