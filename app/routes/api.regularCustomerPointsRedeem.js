import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;

/*
========================================================
REDEEM REWARD CUSTOMER POINTS
========================================================
*/

async function handleRewardRedeem(data) {
  try {
    console.log("🚀 RewardCustomer Redeem Triggered");

    let { email, customerId, discountCode, discountAmount, orderId } = data;

    console.log("📦 Raw Data:", data);

    if (!email || !discountAmount) {
      console.log("❌ Missing required fields");
      return;
    }

    // ✅ Clean
    email = email.trim().toLowerCase();
    discountAmount = parseFloat(discountAmount);

    if (isNaN(discountAmount)) {
      console.log("❌ Invalid discountAmount");
      return;
    }

    console.log("📧 Email:", email);
    console.log("💸 Discount Amount:", discountAmount);

    // ✅ Shopify GID → ID
    const shopifyCustomerId = customerId?.split("/").pop();

    console.log("🆔 Shopify ID:", shopifyCustomerId);

    // ✅ Find RewardCustomer
    const customer = await prisma.rewardCustomer.findFirst({
      where: {
        shop: SHOP,
        shopifyId: shopifyCustomerId
      }
    });

    if (!customer) {
      console.log("❌ RewardCustomer not found");
      return;
    }

    console.log("✅ Customer Found:", customer.id);
    console.log("💰 Current Points:", customer.points);

    // ✅ Redeem logic (1₹ = 1 point)
    const redeemPoints = Math.floor(discountAmount);

    if (customer.points < redeemPoints) {
      console.log("❌ Not enough points");
      return;
    }

    // ✅ Transaction (safe)
    await prisma.$transaction(async (tx) => {

      const updatedCustomer = await tx.rewardCustomer.update({
        where: {
          shop_shopifyId: {
            shop: SHOP,
            shopifyId: shopifyCustomerId
          }
        },
        data: {
          points: {
            decrement: redeemPoints
          }
        }
      });

      console.log("💸 Points Deducted:", redeemPoints);

      // ✅ Ledger entry
      await tx.rewardTransaction.create({
        data: {
          shop: SHOP,
          shopifyId: shopifyCustomerId,
          type: "REDEEM",
          points: -redeemPoints,
          availablePoints: updatedCustomer.points,
          description: `Redeemed via ${discountCode}`,
          orderId: orderId,
          tier: updatedCustomer.tier
        }
      });

      console.log("🧾 RewardCustomer Ledger Created");
    });

  } catch (error) {
    console.error("🔥 RewardCustomer Redeem Error:", error);
  }
}

/*
========================================================
API ROUTE
========================================================
*/

export async function action({ request }) {
  try {
    console.log("🚀 API HIT /api/redeemRewardCustomer");

    const body = await request.json();

    await handleRewardRedeem(body);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("🔥 GLOBAL ERROR:", error);

    return new Response(
      JSON.stringify({ success: false }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}