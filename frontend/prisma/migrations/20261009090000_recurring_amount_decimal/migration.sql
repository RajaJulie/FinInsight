BEGIN;

-- Refuse conversion rather than silently round an existing monetary amount.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "RecurringTransaction"
    WHERE amount::numeric <> round(amount::numeric, 2)
      OR abs(amount::numeric) >= 10000000000
  ) THEN
    RAISE EXCEPTION 'Recurring amounts cannot be converted without precision loss';
  END IF;
END $$;

ALTER TABLE "RecurringTransaction"
  ALTER COLUMN "amount" TYPE DECIMAL(12, 2) USING amount::numeric;

COMMIT;
