import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
REWARD CUSTOMER (1₹ = 1 POINT)
========================================================
*/
async function handleRewardCustomer(email, amountSpent) {
  try {
    const earnedPoints = Math.floor(amountSpent);

    console.log("🎯 [RewardCustomer] Points:", earnedPoints);

    const customer = await prisma.rewardCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("❌ RewardCustomer not found");
      return;
    }

    await prisma.rewardCustomer.update({
      where: { id: customer.id },
      data: {
        points: {
          increment: earnedPoints
        }
      }
    });

    console.log("✅ RewardCustomer updated:", customer.id);

  } catch (err) {
    console.error("🔥 RewardCustomer error:", err);
  }
}

/*
========================================================
PREMIUM CUSTOMER (1₹ = 2 COINS)
========================================================
*/
async function handlePremiumCustomer(email, amountSpent) {
  try {
    const earnedCoins = Math.floor(amountSpent * 2);

    console.log("💎 [PremiumCustomer] Coins:", earnedCoins);

    const customer = await prisma.premiumCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("❌ PremiumCustomer not found");
      return;
    }

    await prisma.premiumCustomer.update({
      where: { id: customer.id },
      data: {
        coins: {
          increment: earnedCoins
        }
      }
    });

    console.log("✅ PremiumCustomer updated:", customer.id);

  } catch (err) {
    console.error("🔥 PremiumCustomer error:", err);
  }
}

/*
========================================================
MAIN API (SHOPIFY FLOW)
========================================================
*/

export async function action({ request }) {
  try {
    console.log("🚀 API HIT /api/premiumCustomerPoints");

    const body = await request.json();

    console.log("📦 BODY:", body);

    let { email, amountSpent } = body;

    if (!email || !amountSpent) {
      console.log("❌ Missing data");
      return new Response("Invalid data", { status: 400 });
    }

    // ✅ Clean + parse
    email = email.trim().toLowerCase();
    amountSpent = parseFloat(amountSpent);

    if (isNaN(amountSpent)) {
      console.log("❌ Invalid amount");
      return new Response("Invalid amount", { status: 400 });
    }

    console.log("📧 Email:", email);
    console.log("💰 Amount:", amountSpent);

    // ✅ Run both logics
    await handleRewardCustomer(email, amountSpent);
    await handlePremiumCustomer(email, amountSpent);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Points processed for both customers"
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