-- CreateTable
CREATE TABLE "trailer_expense" (
    "id" TEXT NOT NULL,
    "trailerId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,

    CONSTRAINT "trailer_expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trailer_expense_trailerId_expenseId_key" ON "trailer_expense"("trailerId", "expenseId");

-- AddForeignKey
ALTER TABLE "trailer_expense" ADD CONSTRAINT "trailer_expense_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer_expense" ADD CONSTRAINT "trailer_expense_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
