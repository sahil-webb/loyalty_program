import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;

export async function action({ request }) {
  try {
    console.log("🚀 Reward Adjust API HIT");

    const body = await request.json();

    let { shopifyId, amount, type, description } = body;

    if (!shopifyId || !amount) {
      return new Response("Missing fields", { status: 400 });
    }

    amount = parseInt(amount);

    if (isNaN(amount)) {
      return new Response("Invalid amount", { status: 400 });
    }

    await prisma.$transaction(async (tx) => {

      const customer = await tx.rewardCustomer.findUnique({
        where: {
          shop_shopifyId: {
            shop: SHOP,
            shopifyId
          }
        }
      });

      if (!customer) throw new Error("Customer not found");

      let updateData;
      let pointsChange;

      if (type === "DEDUCT") {

        if (customer.points < amount) {
          throw new Error("Not enough points");
        }

        updateData = {
          points: { decrement: amount }
        };

        pointsChange = -amount;

      } else {

        updateData = {
          points: { increment: amount }
        };

        pointsChange = amount;
      }

      const updatedCustomer = await tx.rewardCustomer.update({
        where: {
          shop_shopifyId: {
            shop: SHOP,
            shopifyId
          }
        },
        data: updateData
      });

      await tx.rewardTransaction.create({
        data: {
          shop: SHOP,
          shopifyId,
          type: type === "DEDUCT" ? "REDEEM" : "EARN",
          points: pointsChange,
          availablePoints: updatedCustomer.points,
          description: description || "Manual adjustment",
          tier: updatedCustomer.tier
        }
      });

      console.log("✅ RewardCustomer Adjusted");
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error("🔥 Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 }
    );
  }
}