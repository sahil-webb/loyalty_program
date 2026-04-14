import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 🔐 CHANGE THIS (same as Flow header)
const API_SECRET = "regular_birthday_points";

/*
========================================================
BIRTHDAY POINTS CRON HANDLER
========================================================
*/

export async function action({ request }) {
  try {
    // ✅ Security check
    const apiKey = request.headers.get("x-api-key");
    console.log(apiKey);
    if (apiKey !== API_SECRET) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401 }
      );
    }

    const today = new Date();

    // ✅ Extract today's MM-DD
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayKey = `${month}-${day}`;

    const currentYear = today.getFullYear();

    console.log("🎂 Birthday job running for:", todayKey);

    // ✅ Fetch customers with birthdays
    const customers = await prisma.rewardCustomer.findMany({
      where: {
        birthday: {
          not: null
        }
      }
    });

    let rewardedCount = 0;

    for (const customer of customers) {
      try {
        if (!customer.birthday) continue;

        // Expecting YYYY-MM-DD
        const parts = customer.birthday.split("-");
        if (parts.length !== 3) continue;

        const customerKey = `${parts[1]}-${parts[2]}`;

        // 🚫 Prevent duplicate reward in same year
        if (
          customerKey === todayKey &&
          customer.lastBirthdayRewardYear !== currentYear
        ) {
          console.log(`🎉 Rewarding: ${customer.email}`);

          // ✅ Atomic transaction
          await prisma.$transaction(async (tx) => {
            // 1. Update points
            await tx.rewardCustomer.update({
              where: { id: customer.id },
              data: {
                points: {
                  increment: 100
                },
                lastBirthdayRewardYear: currentYear
              }
            });

            // 2. Log transaction
            await tx.pointLedger.create({
              data: {
                shop: customer.shop,
                shopifyId: customer.shopifyId,
                points: 100,
                type: "birthday",
                description: "Birthday reward points"
              }
            });
          });

          rewardedCount++;
        }
      } catch (err) {
        console.error("❌ Error processing customer:", customer.id, err);
      }
    }

    console.log(`✅ Birthday job completed. Rewarded: ${rewardedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        rewarded: rewardedCount
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error("🔥 Birthday job failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500 }
    );
  }
}