/*
  Warnings:

  - Added the required column `shop` to the `PremiumCustomer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PremiumCustomer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `RewardCustomer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "availablePoints" INTEGER NOT NULL,
    "description" TEXT,
    "orderId" TEXT,
    "referralCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PremiumCustomer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "email" TEXT,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "discountCode" TEXT,
    "referralCode" TEXT,
    "signInWithReferral" BOOLEAN NOT NULL DEFAULT false,
    "signInReferralCode" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'insider',
    "lastVisitReward" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PremiumCustomer" ("coins", "createdAt", "discountCode", "email", "id", "referralCode", "shopifyId", "signInReferralCode", "signInWithReferral") SELECT "coins", "createdAt", "discountCode", "email", "id", "referralCode", "shopifyId", "signInReferralCode", "signInWithReferral" FROM "PremiumCustomer";
DROP TABLE "PremiumCustomer";
ALTER TABLE "new_PremiumCustomer" RENAME TO "PremiumCustomer";
CREATE UNIQUE INDEX "PremiumCustomer_referralCode_key" ON "PremiumCustomer"("referralCode");
CREATE INDEX "PremiumCustomer_shop_idx" ON "PremiumCustomer"("shop");
CREATE UNIQUE INDEX "PremiumCustomer_shop_shopifyId_key" ON "PremiumCustomer"("shop", "shopifyId");
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
    "lastVisitReward" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RewardCustomer" ("birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "lastVisitReward", "points", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier") SELECT "birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "lastVisitReward", "points", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier" FROM "RewardCustomer";
DROP TABLE "RewardCustomer";
ALTER TABLE "new_RewardCustomer" RENAME TO "RewardCustomer";
CREATE INDEX "RewardCustomer_shop_idx" ON "RewardCustomer"("shop");
CREATE UNIQUE INDEX "RewardCustomer_shop_shopifyId_key" ON "RewardCustomer"("shop", "shopifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RewardTransaction_shop_shopifyId_idx" ON "RewardTransaction"("shop", "shopifyId");
