import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;

export async function action({ request }) {
  try {
    console.log("🚀 Adjust API HIT");

    const body = await request.json();

    let { shopifyId, amount, type, description } = body;

    console.log("📦 Body:", body);

    if (!shopifyId || !amount) {
      return new Response("Missing fields", { status: 400 });
    }

    amount = parseInt(amount);

    if (isNaN(amount)) {
      return new Response("Invalid amount", { status: 400 });
    }

    await prisma.$transaction(async (tx) => {

      const customer = await tx.premiumCustomer.findUnique({
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

        if (customer.coins < amount) {
          throw new Error("Not enough coins");
        }

        updateData = {
          coins: { decrement: amount }
        };

        pointsChange = -amount;

      } else {

        updateData = {
          coins: { increment: amount }
        };

        pointsChange = amount;
      }

      const updatedCustomer = await tx.premiumCustomer.update({
        where: {
          shop_shopifyId: {
            shop: SHOP,
            shopifyId
          }
        },
        data: updateData
      });

      console.log("💰 New Balance:", updatedCustomer.coins);

      // ✅ Ledger entry
      await tx.rewardTransaction.create({
        data: {
          shop: SHOP,
          shopifyId,
          type: type === "DEDUCT" ? "REDEEM" : "EARN",
          points: pointsChange,
          availablePoints: updatedCustomer.coins,
          description: description || "Manual adjustment",
          tier: updatedCustomer.tier
        }
      });

      console.log("🧾 Ledger Created");
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("🔥 Adjust Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}