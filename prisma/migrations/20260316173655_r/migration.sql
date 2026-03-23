-- CreateTable
CREATE TABLE "PremiumCustomer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PremiumCustomer_shopifyId_key" ON "PremiumCustomer"("shopifyId");
