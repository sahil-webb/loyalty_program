import { PrismaClient } from "@prisma/client";
import { addCustomerPoints } from "./api.pointsLedger.js";
const prisma = new PrismaClient();

const API_SECRET = "regular_birthday_points";
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
export async function action({ request }) {
  try {
    console.log("🚀 API HIT");

    const apiKey = request.headers.get("x-api-key");
    console.log("🔑 API KEY:", apiKey);

    if (apiKey !== API_SECRET) {
      console.log("❌ Unauthorized");
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401 }
      );
    }

    const today = new Date();

    const todayMonth = today.getUTCMonth();
    const todayDate = today.getUTCDate();

    console.log("📅 Today Month:", todayMonth + 1);
    console.log("📅 Today Date:", todayDate);

    // ✅ NO FILTER (important fix)
    const customers = await prisma.premiumCustomer.findMany();

    console.log("👥 Total customers fetched:", customers.length);

    let rewardedCount = 0;

    for (const customer of customers) {
      try {
        console.log("\n------------------------");
        console.log("👤 Processing customer ID:", customer.id);
        console.log("📧 Email:", customer.email);
        console.log("🎂 Raw Birthday:", customer.birthday);

        if (!customer.birthday) {
          console.log("⚠️ No birthday, skipping");
          continue;
        }

        let birthday;

        try {
          birthday = new Date(customer.birthday);
        } catch (e) {
          console.log("❌ Invalid date format:", customer.birthday);
          continue;
        }

        if (isNaN(birthday)) {
          console.log("❌ Parsed invalid date:", customer.birthday);
          continue;
        }

        const customerMonth = birthday.getUTCMonth();
        const customerDate = birthday.getUTCDate();

        console.log("📆 Customer Month:", customerMonth + 1);
        console.log("📆 Customer Date:", customerDate);

        // ✅ Match
        if (customerMonth === todayMonth && customerDate === todayDate) {
          console.log("🎉 MATCH FOUND → Rewarding");

          await prisma.premiumCustomer.update({
            where: { id: customer.id },
            data: {
              coins: {
                increment: 100
              }
            }
          });
    
    
     /* ========================================================
       ADD POINTS USING LEDGER
    ======================================================== */

    customer = await addCustomerPoints({

      shop: SHOP,
      shopifyId: customer.id,
      points: 100,
      type: "EARN",
      description: "Birthday reward"

    });

          rewardedCount++;
        } else {
          console.log("❌ Not matching today");
        }

      } catch (err) {
        console.error("❌ Error processing customer:", customer.id, err);
      }


    }

    console.log("\n✅ FINAL RESULT");
    console.log("🎁 Total Rewarded:", rewardedCount);

    return new Response(
      JSON.stringify({
        success: true,
        rewarded: rewardedCount
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error("🔥 GLOBAL ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500 }
    );
  }
}