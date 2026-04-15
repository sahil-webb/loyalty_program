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

    const todayMonth = today.getMonth(); // 0-based
    const todayDate = today.getDate();

    console.log("🎂 Running birthday job for:", `${todayMonth + 1}-${todayDate}`);

    const customers = await prisma.premiumCustomer.findMany({
      where: {
        NOT: {
          birthday: null
        }
      }
    });

    let rewardedCount = 0;

    for (const customer of customers) {
      try {
        if (!customer.birthday) continue;

        const birthday = new Date(customer.birthday);

        const customerMonth = birthday.getMonth();
        const customerDate = birthday.getDate();

        // ✅ Match only month + date
        if (customerMonth === todayMonth && customerDate === todayDate) {
          console.log(`🎉 Rewarding: ${customer.email}`);

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