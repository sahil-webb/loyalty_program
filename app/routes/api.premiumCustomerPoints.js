import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
PREMIUM CUSTOMER ORDER REWARD (₹ → 2x COINS)
========================================================
*/

export async function addPremiumCustomerOrderReward(data) {
  try {
    console.log("🚀 PremiumCustomer Reward Triggered");

    let { email, amountSpent } = data;

    console.log("📦 Raw Data:", data);

    // ✅ Validate
    if (!email || !amountSpent) {
      console.log("❌ Missing email or amountSpent");
      return;
    }

    // ✅ Clean email
    email = email.trim().toLowerCase();
    console.log("📧 Email:", email);

    // ✅ Convert amount
    amountSpent = parseFloat(amountSpent);
    console.log("💰 Amount Spent:", amountSpent);

    if (isNaN(amountSpent)) {
      console.log("❌ Invalid amountSpent");
      return;
    }

    // ✅ 2x logic
    const earnedCoins = Math.floor(amountSpent * 2);
    console.log("💎 Coins to Add:", earnedCoins);

    // ✅ Find Premium Customer
    const customer = await prisma.premiumCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("❌ PremiumCustomer NOT FOUND:", email);
      return;
    }

    console.log("✅ Customer Found:");
    console.log("🆔 ID:", customer.id);
    console.log("🏷️ Tier:", customer.tier);
    console.log("💰 Current Coins:", customer.coins);

    // ✅ Update coins
    const updatedCustomer = await prisma.premiumCustomer.update({
      where: {
        id: customer.id
      },
      data: {
        coins: {
          increment: earnedCoins
        }
      }
    });

    console.log("✅ Coins Updated Successfully");
    console.log("🎁 Coins Added:", earnedCoins);
    console.log("💰 New Total Coins:", updatedCustomer.coins);

    return updatedCustomer;

  } catch (error) {
    console.error("🔥 PremiumCustomer Reward Error:", error);
  }
}