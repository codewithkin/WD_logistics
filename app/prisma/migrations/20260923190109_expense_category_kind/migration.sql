-- ExpenseCategory gains a `kind`, so reports can ask "how much of this
-- truck's cost is fuel" without matching on whatever the admin named the
-- category. One fleet's "Diesel" is another's "Fuel & lubricants".
ALTER TABLE "expense_category" ADD COLUMN     "kind" TEXT;

-- Best-effort backfill from the existing names, so the truck cost breakdown
-- is useful on day one rather than after someone has re-tagged every
-- category by hand. It is a suggestion, not a decision: admins can change
-- any of these on the category form, and anything unmatched stays NULL
-- rather than being guessed into the wrong bucket.
-- Maintenance runs first, deliberately: "Oil Change" is a service, not fuel,
-- and the fuel rule below matches on oil.
UPDATE "expense_category" SET "kind" = 'maintenance'
  WHERE "kind" IS NULL AND (
    "name" ILIKE '%maintenance%' OR "name" ILIKE '%repair%' OR "name" ILIKE '%service%'
    OR "name" ILIKE '%workshop%' OR "name" ILIKE '%spare%' OR "name" ILIKE '%part%'
    OR "name" ILIKE '%oil change%' OR "name" ILIKE '%greas%'
  );

UPDATE "expense_category" SET "kind" = 'fuel'
  WHERE "kind" IS NULL AND (
    "name" ILIKE '%fuel%' OR "name" ILIKE '%diesel%' OR "name" ILIKE '%petrol%'
    OR "name" ILIKE '%lubricant%' OR "name" ILIKE '%engine oil%'
  );

UPDATE "expense_category" SET "kind" = 'tyres'
  WHERE "kind" IS NULL AND ("name" ILIKE '%tyre%' OR "name" ILIKE '%tire%');

UPDATE "expense_category" SET "kind" = 'tolls'
  WHERE "kind" IS NULL AND (
    "name" ILIKE '%toll%' OR "name" ILIKE '%weighbridge%' OR "name" ILIKE '%border%'
  );

UPDATE "expense_category" SET "kind" = 'permits'
  WHERE "kind" IS NULL AND (
    "name" ILIKE '%permit%' OR "name" ILIKE '%licen%' OR "name" ILIKE '%clearing%'
    OR "name" ILIKE '%customs%'
  );

UPDATE "expense_category" SET "kind" = 'salaries'
  WHERE "kind" IS NULL AND (
    "name" ILIKE '%salar%' OR "name" ILIKE '%wage%' OR "name" ILIKE '%allowance%'
    OR "name" ILIKE '%subsistence%' OR "name" ILIKE '%driver pay%'
  );

UPDATE "expense_category" SET "kind" = 'insurance'
  WHERE "kind" IS NULL AND "name" ILIKE '%insur%';
