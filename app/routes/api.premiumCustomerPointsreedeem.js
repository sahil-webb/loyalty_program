import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;

/*
========================================================
REDEEM USING CLOSEST POINT RULE (PREMIUM CUSTOMER)
========================================================
*/

async function handlePremiumRedeem(data) {
  try {
    console.log("🚀 Premium Redeem Triggered (Closest Rule)");

    let { email, customerId, discountCode, discountAmount, orderId } = data;

    console.log("📦 Raw Data:", data);

    if (!email || !discountAmount || !customerId) {
      console.log("❌ Missing required fields");
      return;
    }

    // ✅ Clean inputs
    email = email.trim().toLowerCase();
    discountAmount = parseFloat(discountAmount);

    if (isNaN(discountAmount)) {
      console.log("❌ Invalid discountAmount");
      return;
    }

    console.log("📧 Email:", email);
    console.log("💸 Discount Used:", discountAmount);

    // ✅ Convert Shopify GID → ID
    const shopifyCustomerId = customerId?.split("/").pop();

    console.log("🆔 Shopify ID:", shopifyCustomerId);

    /*
    ========================================================
    FIND CUSTOMER
    ========================================================
    */

    const customer = await prisma.premiumCustomer.findFirst({
      where: {
        shop: SHOP,
        shopifyId: shopifyCustomerId
      }
    });

    if (!customer) {
      console.log("❌ PremiumCustomer not found");
      return;
    }

    console.log("✅ Customer Found:", customer.id);
    console.log("💰 Current Coins:", customer.coins);

    /*
    ========================================================
    GET ALL RULES
    ========================================================
    */

    const rules = await prisma.regularPointRule.findMany();

    if (!rules.length) {
      console.log("❌ No rules found");
      return;
    }

    /*
    ========================================================
    FIND CLOSEST RULE
    ========================================================
    */

    let closestRule = null;
    let minDiff = Infinity;

    for (const rule of rules) {
      const diff = Math.abs(rule.discount - discountAmount);

      if (diff < minDiff) {
        minDiff = diff;
        closestRule = rule;
      }
    }

    if (!closestRule) {
      console.log("❌ No closest rule found");
      return;
    }

    console.log("🎯 Closest Rule Selected:");
    console.log("Points:", closestRule.points);
    console.log("Discount:", closestRule.discount);

    /*
    ========================================================
    SAFETY CHECK
    ========================================================
    */

    if (customer.coins < closestRule.points) {
      console.log("❌ Not enough coins");
      return;
    }

    /*
    ========================================================
    TRANSACTION (DEDUCT + LEDGER)
    ========================================================
    */

    await prisma.$transaction(async (tx) => {

      const updatedCustomer = await tx.premiumCustomer.update({
        where: {
          shop_shopifyId: {
            shop: SHOP,
            shopifyId: shopifyCustomerId
          }
        },
        data: {
          coins: {
            decrement: closestRule.points
          }
        }
      });

      console.log("💸 Coins Deducted:", closestRule.points);

      await tx.rewardTransaction.create({
        data: {
          shop: SHOP,
          shopifyId: shopifyCustomerId,
          type: "REDEEM",
          points: -closestRule.points,
          availablePoints: updatedCustomer.coins,
          description: `Redeemed ₹${discountAmount} (closest rule ₹${closestRule.discount})`,
          orderId: orderId,
          tier: updatedCustomer.tier
        }
      });

      console.log("🧾 Ledger Entry Created");
    });

  } catch (error) {
    console.error("🔥 Premium Redeem Error:", error);
  }
}

/*
========================================================
API ROUTE
========================================================
*/

export async function action({ request }) {
  try {
    console.log("🚀 API HIT /api/redeemPremiumCustomer");

    const body = await request.json();

    await handlePremiumRedeem(body);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Premium redeem processed using closest rule"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("🔥 GLOBAL ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}