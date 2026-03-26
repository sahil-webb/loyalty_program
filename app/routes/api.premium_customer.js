import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API STARTED");

    const body = await request.json();
    console.log("📩 Incoming body:", body);

    const { secret, email, customer_id } = body;

    /* -----------------------
       VALIDATE SECRET
    ------------------------*/

    if (secret !== "premium_customer") {
      console.log("❌ Invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("🔐 Authenticating Shopify Admin");

    const { admin } = await authenticate.admin(request);

    console.log("✅ Admin authenticated");

    /* -----------------------
       CUSTOMER ID
    ------------------------*/

    const customerId = customer_id.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Customer ID:", customerId);

    /* -----------------------
       CREATE / UPDATE CUSTOMER
    ------------------------*/

    console.log("🔎 Checking customer in DB");

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email }
    });

    if (customer) {

      console.log("➕ Customer exists → add 500 coins");

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
       FIND DISCOUNT RULE
    ------------------------*/

    console.log("📊 Finding matching rule");

    const rule = await prisma.premiumPointRule.findFirst({
      where: {
        points: { lte: customer.coins }
      },
      orderBy: {
        points: "desc"
      }
    });

    console.log("📊 Rule found:", rule);

    if (!rule) {
      console.log("⚠️ No rule found");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount:", discountAmount);

    /* -----------------------
       DISCOUNT CODE
    ------------------------*/

    const discountCode = `VIP-${customerId}`;

    console.log("🏷 Discount code:", discountCode);

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    console.log("➕ Creating discount");

    const response = await admin.graphql(
      `
      mutation ($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          userErrors { message }
        }
      }
      `,
      {
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
            },

            usageLimit: 1000,

            combinesWith: {
              shippingDiscounts: true,
              orderDiscounts: false,
              productDiscounts: false
            }
          }
        }
      }
    );

    const result = await response.json();

    console.log("📦 Shopify response:", result);

    console.log("🎉 DONE");

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