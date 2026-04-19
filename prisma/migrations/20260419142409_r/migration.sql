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
    "birthday" DATETIME NOT NULL DEFAULT '2002-04-15 00:00:00 +00:00',
    "tier" TEXT NOT NULL DEFAULT 'VIP',
    "lastVisitReward" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PremiumCustomer" ("birthday", "coins", "createdAt", "discountCode", "email", "id", "lastVisitReward", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt") SELECT "birthday", "coins", "createdAt", "discountCode", "email", "id", "lastVisitReward", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt" FROM "PremiumCustomer";
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
    "lastVisitReward" DATETIME,
    "tier" TEXT NOT NULL DEFAULT 'Regular',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RewardCustomer" ("birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "points", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt") SELECT "birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "points", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt" FROM "RewardCustomer";
DROP TABLE "RewardCustomer";
ALTER TABLE "new_RewardCustomer" RENAME TO "RewardCustomer";
CREATE UNIQUE INDEX "RewardCustomer_shop_shopifyId_key" ON "RewardCustomer"("shop", "shopifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
