import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
ADD CUSTOMER POINTS (ONLY TRANSACTION - NO CUSTOMER UPDATE)
========================================================
*/

export async function addCustomerPoints_regular({
  shop,
  shopifyId,
  points,
  type,
  description = null,
  orderId = null,
  referralCode = null
}) {
  return await prisma.$transaction(async (tx) => {

    // 1. Check if customer exists
    const customer = await tx.rewardCustomer.findUnique({
      where: {
        shop_shopifyId: {
          shop,
          shopifyId
        }
      }
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // 2. Calculate current balance from transactions (ledger approach)
    const balanceData = await tx.rewardTransaction.aggregate({
      _sum: {
        points: true
      },
      where: {
        shop,
        shopifyId
      }
    });

    const currentPoints = balanceData._sum.points || 0;
    const newBalance = currentPoints + points;

    // 3. Create transaction entry
    const transaction = await tx.rewardTransaction.create({
      data: {
        shop,
        shopifyId,
        type,
        points,
        availablePoints: newBalance,
        description,
        orderId,
        referralCode,
        tier: customer.tier
      }
    });

    console.log("💰 Points transaction added:", {
      added: points,
      newBalance
    });

    return transaction;
  });
}

/*
========================================================
REDEEM CUSTOMER POINTS (ONLY TRANSACTION - NO CUSTOMER UPDATE)
========================================================
*/

export async function redeemCustomerPoints({
  shop,
  shopifyId,
  points,
  description = "Redeem reward"
}) {
  return await prisma.$transaction(async (tx) => {

    // 1. Check if customer exists
    const customer = await tx.rewardCustomer.findUnique({
      where: {
        shop_shopifyId: {
          shop,
          shopifyId
        }
      }
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // 2. Get current balance from transactions
    const balanceData = await tx.rewardTransaction.aggregate({
      _sum: {
        points: true
      },
      where: {
        shop,
        shopifyId
      }
    });

    const currentPoints = balanceData._sum.points || 0;

    // 3. Validation
    if (currentPoints < points) {
      throw new Error("Not enough points");
    }

    const newBalance = currentPoints - points;

    // 4. Create redeem transaction
    const transaction = await tx.rewardTransaction.create({
      data: {
        shop,
        shopifyId,
        type: "REDEEM",
        points: -points,
        availablePoints: newBalance,
        description,
        tier: customer.tier
      }
    });

    console.log("🎁 Points redeemed:", {
      redeemed: points,
      newBalance
    });

    return transaction;
  });
}