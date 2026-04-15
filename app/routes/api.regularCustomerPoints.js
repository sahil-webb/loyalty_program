import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
REWARD CUSTOMER FUNCTION (1₹ = 1 POINT)
========================================================
*/

async function addRewardCustomerOrderPoints(data) {
  try {
    console.log("📦 Incoming Data:", data);

    let { email, amountSpent } = data;

    if (!email || !amountSpent) {
      console.log("❌ Missing email or amountSpent");
      return;
    }

    // ✅ Clean email
    email = email.trim().toLowerCase();

    // ✅ Convert amount
    amountSpent = parseFloat(amountSpent);

    if (isNaN(amountSpent)) {
      console.log("❌ Invalid amountSpent:", amountSpent);
      return;
    }

    // ✅ 1₹ = 1 point
    const earnedPoints = Math.floor(amountSpent);

    console.log("💰 Amount:", amountSpent);
    console.log("🎁 Points:", earnedPoints);

    // ✅ Find customer
    const customer = await prisma.rewardCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("❌ Customer not found:", email);
      return;
    }

    console.log("✅ Customer Found:", customer.id);

    // ✅ Update points
    const updatedCustomer = await prisma.rewardCustomer.update({
      where: {
        id: customer.id
      },
      data: {
        points: {
          increment: earnedPoints
        }
      }
    });

    console.log("✅ Points Updated:", updatedCustomer.points);

  } catch (error) {
    console.error("🔥 Reward function error:", error);
  }
}

/*
========================================================
API ROUTE (SHOPIFY FLOW CALLS THIS)
========================================================
*/

export async function action({ request }) {
  try {
    console.log("🚀 API HIT /api/premiumCustomerPoints");

    // ✅ Parse request body
    const body = await request.json();

    console.log("📦 BODY RECEIVED:", body);

    // ✅ Call function
    await addRewardCustomerOrderPoints(body);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Points added"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("🔥 API ERROR:", error);

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