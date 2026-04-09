-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RewardTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "availablePoints" INTEGER NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'insider',
    "description" TEXT,
    "orderId" TEXT,
    "referralCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RewardTransaction" ("availablePoints", "createdAt", "description", "id", "orderId", "points", "referralCode", "shop", "shopifyId", "type") SELECT "availablePoints", "createdAt", "description", "id", "orderId", "points", "referralCode", "shop", "shopifyId", "type" FROM "RewardTransaction";
DROP TABLE "RewardTransaction";
ALTER TABLE "new_RewardTransaction" RENAME TO "RewardTransaction";
CREATE INDEX "RewardTransaction_shop_shopifyId_idx" ON "RewardTransaction"("shop", "shopifyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
