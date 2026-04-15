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
    "birthday" DATETIME NOT NULL DEFAULT '2002-04-15',
    "tier" TEXT NOT NULL DEFAULT 'insider',
    "lastVisitReward" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PremiumCustomer" ("coins", "createdAt", "discountCode", "email", "id", "lastVisitReward", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt") SELECT "coins", "createdAt", "discountCode", "email", "id", "lastVisitReward", "referralCode", "shop", "shopifyId", "signInReferralCode", "signInWithReferral", "tier", "updatedAt" FROM "PremiumCustomer";
DROP TABLE "PremiumCustomer";
ALTER TABLE "new_PremiumCustomer" RENAME TO "PremiumCustomer";
CREATE UNIQUE INDEX "PremiumCustomer_referralCode_key" ON "PremiumCustomer"("referralCode");
CREATE INDEX "PremiumCustomer_shop_idx" ON "PremiumCustomer"("shop");
CREATE UNIQUE INDEX "PremiumCustomer_shop_shopifyId_key" ON "PremiumCustomer"("shop", "shopifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
