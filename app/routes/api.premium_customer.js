import { PrismaClient } from "@prisma/client";
import { shopify } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API STARTED");

    const body = await request.json();
    console.log("📩 Incoming body:", body);

    const { secret, email, customer_id, shop } = body;

    /* -----------------------
       VALIDATE SECRET
    ------------------------*/

    if (secret !== "premium_customer") {
      console.log("❌ Invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }

    if (!shop) {
      console.log("❌ Shop missing");
      return new Response("Shop missing", { status: 400 });
    }

    console.log("🏪 Shop:", shop);

    /* -----------------------
       LOAD OFFLINE SESSION
    ------------------------*/

    console.log("🔐 Loading offline session");

    const session = await shopify.sessionStorage.loadSession(
      `offline_${shop}`
    );

    if (!session) {
      console.log("❌ Offline session not found");
      return new Response("No session found", { status: 500 });
    }

    console.log("✅ Offline session loaded");

    const admin = new shopify.clients.Graphql({ session });

    console.log("✅ Shopify admin client ready");

    /* -----------------------
       CUSTOMER ID
    ------------------------*/

    const customerId = customer_id.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Shopify customer:", customerId);

    /* -----------------------
       CREATE / UPDATE CUSTOMER
    ------------------------*/

    console.log("🔎 Checking customer in database");

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email }
    });

    if (customer) {

      console.log("➕ Customer exists → adding 500 coins");

      customer = await prisma.premiumCustomer.update({
        where: { email },
        data: {
          coins: {
            increment: 500
          }
        }
      });

    } else {

      console.log("🆕 Customer not found → creating new customer");

      customer = await prisma.premiumCustomer.create({
        data: {
          shopifyId: customerId,
          email,
          coins: 500
        }
      });

    }

    console.log("💰 Customer coins:", customer.coins);

    /* -----------------------
       FIND MATCHING POINT RULE
    ------------------------*/

    console.log("📊 Searching discount rule");

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
      console.log("⚠️ No discount rule matched");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount amount:", discountAmount);

    /* -----------------------
       CREATE DISCOUNT CODE
    ------------------------*/

    const discountCode = `VIP-${customerId}`;

    console.log("🏷 Discount code:", discountCode);

    console.log("➕ Creating Shopify discount");

    const response = await admin.query({
      data: {
        query: `
          mutation ($input: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $input) {
              userErrors { message }
            }
          }
        `,
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
    });

    console.log("📦 Shopify response:", response.body);

    console.log("🎉 PROCESS COMPLETED");

    return new Response(JSON.stringify({
      success: true,
      coins: customer.coins,
      discount: discountAmount,
      code: discountCode
    }));

  } catch (error) {

    console.error("❌ Premium loyalty error:", error);

    return new Response(JSON.stringify({
      error: "Server error"
    }), { status: 500 });

  }
};