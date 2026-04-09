import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
ADD CUSTOMER POINTS (Atomic Safe Transaction)
========================================================
*/

export async function addCustomerPoints({
  shop,
  shopifyId,
  points,
  type,
  description = null,
  orderId = null,
  referralCode = null
}) {

  return await prisma.$transaction(async (tx) => {

    const customer = await tx.premiumCustomer.findUnique({
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

    const updatedCustomer = await tx.premiumCustomer.update({
      where: {
        shop_shopifyId: {
          shop,
          shopifyId
        }
      },
      data: {
        coins: {
          increment: points
        }
      }
    });

    await tx.rewardTransaction.create({
      data: {
        shop,
        shopifyId,
        type,
        points,
        availablePoints: updatedCustomer.coins,
        description,
        orderId,
        referralCode,
        tier: updatedCustomer.tier
      }
    });

    console.log("💰 Points added:", points);

    return updatedCustomer;

  });

}

/*
========================================================
REDEEM CUSTOMER POINTS
========================================================
*/

export async function redeemCustomerPoints({
  shop,
  shopifyId,
  points,
  description = "Redeem reward"
}) {

  return await prisma.$transaction(async (tx) => {

    const customer = await tx.premiumCustomer.findUnique({
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

    if (customer.coins < points) {
      throw new Error("Not enough points");
    }

    const updatedCustomer = await tx.premiumCustomer.update({
      where: {
        shop_shopifyId: {
          shop,
          shopifyId
        }
      },
      data: {
        coins: {
          decrement: points
        }
      }
    });

    await tx.rewardTransaction.create({
      data: {
        shop,
        shopifyId,
        type: "REDEEM",
        points: -points,
        availablePoints: updatedCustomer.coins,
        description,
        tier: updatedCustomer.tier
      }
    });

    console.log("🎁 Points redeemed:", points);

    return updatedCustomer;

  });

}