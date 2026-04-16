import { PrismaClient } from "@prisma/client";
import { addCustomerPoints } from "./api.pointsLedger.js";
const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;

/*
========================================================
REDEEM PREMIUM CUSTOMER POINTS
========================================================
*/

async function handleRedeem(data) {
  try {
    console.log("🚀 Redeem Triggered");

    let { email, customerId, discountCode, discountAmount, orderId } = data;
console.log("📦 Raw Data:", email);
console.log("📦 Raw Data:", customerId);
console.log("📦 Raw Data:", discountCode);
console.log("📦 Raw Data:", discountAmount);
console.log("📦 Raw Data:", orderId);

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
    console.log("💸 Discount Amount::", discountAmount);

    // ✅ Convert Shopify GID → ID
    const shopifyCustomerId = customerId?.split("/").pop();

    console.log("🆔 Shopify ID:", shopifyCustomerId);

    // ✅ Find Premium Customer
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

    // ✅ Deduct coins (1₹ = 1 coin redeem logic)
    const redeemCoins = Math.floor(discountAmount);

    if (customer.coins < redeemCoins) {
      console.log("❌ Not enough coins");
      return;
    }

 await addCustomerPoints({
            shop: SHOP,
            shopifyId: customerId, // ✅ FIXED
            points: -redeemCoins,
            type: "REDEEM",
            description: "Order Redeem"
          });



    // // ✅ Transaction (safe)
    // await prisma.$transaction(async (tx) => {

    //   const updatedCustomer = await tx.premiumCustomer.update({
    //     where: {
    //       shop_shopifyId: {
    //         shop: SHOP,
    //         shopifyId: shopifyCustomerId
    //       }
    //     },
    //     data: {
    //       coins: {
    //         decrement: redeemCoins
    //       }
    //     }
    //   });

    //   console.log("💸 Coins Deducted:", redeemCoins);

    //   // ✅ Ledger entry
    //   await tx.rewardTransaction.create({
    //     data: {
    //       shop: SHOP,
    //       shopifyId: shopifyCustomerId,
    //       type: "REDEEM",
    //       points: -redeemCoins,
    //       availablePoints: updatedCustomer.coins,
    //       description: `Redeemed via ${discountCode}`,
    //       orderId: orderId,
    //       tier: updatedCustomer.tier
    //     }
    //   });

    //   console.log("🧾 Redeem Ledger Created");
    // });

  } catch (error) {
    console.error("🔥 Redeem Error:", error);
  }
}

/*
========================================================
API ROUTE
========================================================
*/

export async function action({ request }) {
  try {
    console.log("🚀 API HIT /api/redeemPoints");

    const body = await request.json();

    await handleRedeem(body);

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