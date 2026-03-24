/*
  Warnings:

  - A unique constraint covering the columns `[points]` on the table `PremiumPointRule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[points]` on the table `RegularPointRule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PremiumPointRule_points_key" ON "PremiumPointRule"("points");

-- CreateIndex
CREATE UNIQUE INDEX "RegularPointRule_points_key" ON "RegularPointRule"("points");
