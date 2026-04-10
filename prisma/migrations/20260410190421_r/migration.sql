/*
  Warnings:

  - You are about to drop the column `lastVisitReward` on the `RewardCustomer` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RewardCustomer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "birthday" TEXT,
    "discountCode" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "signInWithReferral" BOOLEAN NOT NULL DEFAULT false,
    "signInReferralCode" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'insider',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RewardCustomer" ("birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "points", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt") SELECT "birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "points", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt" FROM "RewardCustomer";
DROP TABLE "RewardCustomer";
ALTER TABLE "new_RewardCustomer" RENAME TO "RewardCustomer";
CREATE UNIQUE INDEX "RewardCustomer_shop_shopifyId_key" ON "RewardCustomer"("shop", "shopifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
