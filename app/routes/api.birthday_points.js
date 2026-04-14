import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_SECRET = "regular_birthday_points";

export async function action({ request }) {
  try {
  
    const apiKey = request.headers.get("x-api-key");
    console.log(apiKey);
    if (apiKey !== API_SECRET) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401 }
      );
    }

    const today = new Date();

    const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
    const todayDate = String(today.getDate()).padStart(2, "0");
    const todayKey = `${todayMonth}-${todayDate}`;

    console.log("🎂 Running birthday job for:", todayKey);

    const customers = await prisma.rewardCustomer.findMany({
      where: {
        birthday: { not: null }
      }
    });

    let rewardedCount = 0;

    for (const customer of customers) {
      try {
        if (!customer.birthday) continue;

        // Expect YYYY-MM-DD
        const parts = customer.birthday.split("-");
        if (parts.length !== 3) continue;

        const customerKey = `${parts[1]}-${parts[2]}`;

        if (customerKey === todayKey) {
          console.log(`🎉 Rewarding: ${customer.email}`);

          await prisma.$transaction(async (tx) => {
            // ➕ Add points
            await tx.rewardCustomer.update({
              where: { id: customer.id },
              data: {
                points: {
                  increment: 100
                }
              }
            });

            // 🧾 Ledger entry
            await tx.pointLedger.create({
              data: {
                shop: customer.shop,
                shopifyId: customer.shopifyId,
                points: 100,
                type: "birthday",
                description: "Birthday reward"
              }
            });
          });

          rewardedCount++;
        }
      } catch (err) {
        console.error("❌ Error processing customer:", customer.id, err);
      }
    }

    console.log(`✅ Done. Rewarded: ${rewardedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        rewarded: rewardedCount
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error("🔥 Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500 }
    );
  }
}