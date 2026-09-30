-- How much was bought, and in what unit: litres of diesel, tyres fitted,
-- hours of labour. Nullable on purpose — every expense recorded before this
-- has no quantity, and the app says "not recorded" rather than showing a 0
-- that would drag a fleet's fuel economy to nonsense.
ALTER TABLE "expense" ADD COLUMN "quantity" DOUBLE PRECISION;
ALTER TABLE "expense" ADD COLUMN "unit" TEXT;
