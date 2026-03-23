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
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RewardCustomer" ("birthday", "createdAt", "email", "firstName", "id", "lastName", "shop", "shopifyId") SELECT "birthday", "createdAt", "email", "firstName", "id", "lastName", "shop", "shopifyId" FROM "RewardCustomer";
DROP TABLE "RewardCustomer";
ALTER TABLE "new_RewardCustomer" RENAME TO "RewardCustomer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
