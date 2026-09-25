-- Merge the legacy expense category "Autre" into the default "Autres"
-- without deleting any transaction.
DO $$
DECLARE
    source_category RECORD;
    target_category_id TEXT;
BEGIN
    FOR source_category IN
        SELECT "id", "userId"
        FROM "Category"
        WHERE "type" = 'EXPENSE'::"TransactionType"
          AND lower(btrim("name")) = 'autre'
    LOOP
        SELECT "id"
        INTO target_category_id
        FROM "Category"
        WHERE "userId" = source_category."userId"
          AND "type" = 'EXPENSE'::"TransactionType"
          AND lower(btrim("name")) = 'autres'
        LIMIT 1;

        IF target_category_id IS NULL THEN
            UPDATE "Category"
            SET "name" = 'Autres', "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = source_category."id";

            UPDATE "Transaction"
            SET "category" = 'Autres'
            WHERE "categoryId" = source_category."id";
        ELSE
            UPDATE "Transaction"
            SET "categoryId" = target_category_id,
                "category" = 'Autres'
            WHERE "categoryId" = source_category."id";

            UPDATE "Transaction"
            SET "categoryId" = target_category_id,
                "category" = 'Autres'
            WHERE "userId" = source_category."userId"
              AND "type" = 'EXPENSE'::"TransactionType"
              AND "categoryId" IS NULL
              AND lower(btrim("category")) = 'autre';

            DELETE FROM "Category"
            WHERE "id" = source_category."id";
        END IF;
    END LOOP;
END $$;
