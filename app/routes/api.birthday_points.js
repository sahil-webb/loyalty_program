import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_SECRET = "regular_birthday_points";

export async function action({ request }) {
  try {
    const apiKey = request.headers.get("x-api-key");

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

    const customers = await prisma.premiumCustomer.findMany({
      where: {
        birthday: { not: null }
      }
    });

    let rewardedCount = 0;

    for (const customer of customers) {
      try {
        if (!customer.birthday) continue;

        // Expect YYYY-MM-DD (string)
        const parts = customer.birthday.split("-");
        if (parts.length !== 3) continue;

        const customerKey = `${parts[1]}-${parts[2]}`;

        // ✅ Match only month + day
        if (customerKey === todayKey) {
          console.log(`🎉 Rewarding: ${customer.email}`);

          // ➕ Direct update (NO transaction needed)
          await prisma.premiumCustomer.update({
            where: { id: customer.id },
            data: {
              coins: {
                increment: 100
              }
            }
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