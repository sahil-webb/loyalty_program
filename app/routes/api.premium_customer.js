import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API STARTED");

    const body = await request.json();
    console.log("📩 Incoming body:", body);

    const { secret, email, customer_id, shop } = body;

    if (secret !== "premium_customer") {
      console.log("❌ Invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("🔐 Authenticating admin for shop:", shop);

    const { admin } = await authenticate.admin(request);

    console.log("✅ Admin client ready");

    /* -----------------------
       CUSTOMER ID
    ------------------------*/

    const customerId = customer_id.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Customer ID:", customerId);

    /* -----------------------
       CREATE / UPDATE CUSTOMER
    ------------------------*/

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email }
    });

    if (customer) {

      console.log("➕ Adding 500 coins");

      customer = await prisma.premiumCustomer.update({
        where: { email },
        data: {
          coins: {
            increment: 500
          }
        }
      });

    } else {

      console.log("🆕 Creating new customer");

      customer = await prisma.premiumCustomer.create({
        data: {
          shopifyId: customerId,
          email,
          coins: 500
        }
      });

    }

    console.log("💰 Coins:", customer.coins);

    /* -----------------------
       FIND RULE
    ------------------------*/

    const rule = await prisma.premiumPointRule.findFirst({
      where: {
        points: {
          lte: customer.coins
        }
      },
      orderBy: {
        points: "desc"
      }
    });

    console.log("📊 Rule found:", rule);

    if (!rule) {
      console.log("⚠️ No rule matched");
      return new Response(JSON.stringify({ success: true }));
    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount amount:", discountAmount);

    const discountCode = `VIP-${customerId}`;

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    console.log("➕ Creating discount code");

    const response = await admin.graphql(`
      mutation ($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          userErrors { message }
        }
      }
    `, {
      variables: {
        input: {
          title: discountCode,
          code: discountCode,
          startsAt: new Date().toISOString(),

          customerSelection: {
            customers: { add: [shopifyCustomerId] }
          },

          customerGets: {
            items: { all: true },
            value: {
              discountAmount: {
                amount: String(discountAmount),
                appliesOnEachItem: false
              }
            }
          }
        }
      }
    });

    const result = await response.json();

    console.log("✅ Discount creation response:", result);

    console.log("🎉 PROCESS COMPLETE");

    return new Response(JSON.stringify({
      success: true,
      coins: customer.coins,
      discount: discountAmount
    }));

  } catch (error) {

    console.error("❌ Premium loyalty error:", error);

    return new Response(JSON.stringify({
      error: "Server error"
    }), { status: 500 });

  }
};