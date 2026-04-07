-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PremiumCustomer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyId" TEXT NOT NULL,
    "email" TEXT,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "discountCode" TEXT,
    "referralCode" TEXT,
    "signInWithReferral" BOOLEAN NOT NULL DEFAULT false,
    "signInReferralCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PremiumCustomer" ("coins", "createdAt", "discountCode", "email", "id", "shopifyId") SELECT "coins", "createdAt", "discountCode", "email", "id", "shopifyId" FROM "PremiumCustomer";
DROP TABLE "PremiumCustomer";
ALTER TABLE "new_PremiumCustomer" RENAME TO "PremiumCustomer";
CREATE UNIQUE INDEX "PremiumCustomer_shopifyId_key" ON "PremiumCustomer"("shopifyId");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RewardCustomer" ("birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "points", "shop", "shopifyId") SELECT "birthday", "createdAt", "discountCode", "email", "firstName", "id", "lastName", "points", "shop", "shopifyId" FROM "RewardCustomer";
DROP TABLE "RewardCustomer";
ALTER TABLE "new_RewardCustomer" RENAME TO "RewardCustomer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
