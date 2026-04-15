import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
PREMIUM CUSTOMER ORDER REWARD (2x COINS)
========================================================
*/

export async function addPremiumCustomerOrderReward(data) {
  try {
    let { email, amountSpent } = data;

    console.log("📦 Incoming Data:", data);

    if (!email || !amountSpent) {
      console.log("❌ Missing email or amountSpent");
      return;
    }

    // ✅ Convert Shopify Flow string → number
    amountSpent = parseFloat(amountSpent);

    if (isNaN(amountSpent)) {
      console.log("❌ Invalid amountSpent:", amountSpent);
      return;
    }

    // ✅ 2x reward logic (₹30 → 60 coins)
    const earnedCoins = Math.floor(amountSpent * 2);

    console.log("💰 Amount Spent:", amountSpent);
    console.log("🎁 Coins Earned:", earnedCoins);

    // ✅ Find Premium Customer
    const customer = await prisma.premiumCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("❌ Premium customer not found:", email);
      return;
    }

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

    console.log(`✅ ${earnedCoins} coins added to ${email}`);
    console.log("💰 Total Coins:", updatedCustomer.coins);

    return updatedCustomer;

  } catch (error) {
    console.error("🔥 Premium reward error:", error);
  }
}