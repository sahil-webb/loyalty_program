import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
ADD CUSTOMER POINTS (Atomic Safe Transaction)
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

    // const updatedCustomer = await tx.rewardCustomer.update({
    //   where: {
    //     shop_shopifyId: {
    //       shop,
    //       shopifyId
    //     }
    //   },
    //   data: {
    //     points: {
    //       increment: points
    //     }
    //   }
    // });

    await tx.rewardTransaction.create({
      data: {
        shop,
        shopifyId,
        type,
        points,
        availablePoints: updatedCustomer.points,
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

    if (customer.points < points) {
      throw new Error("Not enough points");
    }

    const updatedCustomer = await tx.rewardCustomer.update({
      where: {
        shop_shopifyId: {
          shop,
          shopifyId
        }
      },
      data: {
        points: {
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
        availablePoints: updatedCustomer.points,
        description,
        tier: updatedCustomer.tier
      }
    });

    console.log("🎁 Points redeemed:", points);

    return updatedCustomer;

  });

}