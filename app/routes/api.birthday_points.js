import { PrismaClient } from "@prisma/client";
import { addCustomerPoints } from "./api.pointsLedger.js";

const prisma = new PrismaClient();

const API_SECRET = "regular_birthday_points";
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;

export async function action({ request }) {
  try {
    console.log("🚀 API HIT");

    const apiKey = request.headers.get("x-api-key");

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

    console.log("📅 Today:", todayMonth + 1, todayDate);

    const customers = await prisma.premiumCustomer.findMany();

    console.log("👥 Total customers:", customers.length);

    let rewardedCount = 0;

    for (const customer of customers) {
      try {
        console.log("\n------------------------");
        console.log("👤 ID:", customer.id);
        console.log("📧 Email:", customer.email);

        if (!customer.birthday) {
          console.log("⚠️ No birthday");
          continue;
        }

        const birthday = new Date(customer.birthday);

        if (isNaN(birthday)) {
          console.log("❌ Invalid birthday:", customer.birthday);
          continue;
        }

        const customerMonth = birthday.getUTCMonth();
        const customerDate = birthday.getUTCDate();

        console.log("🎂 Customer:", customerMonth + 1, customerDate);

        if (customerMonth === todayMonth && customerDate === todayDate) {
          console.log("🎉 Birthday match!");

          // ✅ ONLY USE LEDGER FUNCTION
          await addCustomerPoints({
            shop: SHOP,
            shopifyId: customer.shopifyId, // ✅ FIXED
            points: 100,
            type: "EARN",
            description: "Birthday reward"
          });

          rewardedCount++;
        } else {
          console.log("❌ Not today");
        }

      } catch (err) {
        console.error("❌ Error:", customer.id, err);
      }
    }

    console.log("✅ Rewarded:", rewardedCount);

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