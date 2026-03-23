-- CreateTable
CREATE TABLE "RewardRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pointsPerUnit" REAL NOT NULL,
    "currencyUnit" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
