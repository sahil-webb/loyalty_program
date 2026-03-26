import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ========================================================
ENV VARIABLES
======================================================== */

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const FLOW_SECRET = process.env.FLOW_SECRET;

if (!SHOP || !ACCESS_TOKEN) {
  throw new Error("Missing Shopify environment variables");
}

/* ========================================================
SHOPIFY GRAPHQL HELPER
======================================================== */

async function shopifyGraphQL(query, variables = {}) {

  const response = await fetch(
    `https://${SHOP}/admin/api/2024-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN
      },
      body: JSON.stringify({ query, variables })
    }
  );

  return response.json();
}

/* ========================================================
FLOW API
======================================================== */

export const action = async ({ request }) => {

  try {

    console.log("🚀 Flow API triggered");

    const body = await request.json();

    console.log("📩 Incoming body:", body);

    const { email, customer_id, secret } = body;

    /* -----------------------
       SECRET VALIDATION
    ----------------------- */

    if (secret !== FLOW_SECRET) {

      console.log("❌ Invalid secret");

      return new Response("Unauthorized", { status: 401 });

    }

    if (!customer_id) {

      return new Response("Missing customer id", { status: 400 });

    }

    /* -----------------------
       CUSTOMER ID
    ----------------------- */

    const customerId = customer_id.split("/").pop();

    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Customer:", customerId);

    /* -----------------------
       FIND CUSTOMER
    ----------------------- */

    let customer = await prisma.premiumCustomer.findUnique({
      where: {
        shopifyId: customerId
      }
    });

    /* -----------------------
       CREATE OR UPDATE
    ----------------------- */

    if (customer) {

      console.log("➕ Existing customer → +500 coins");

      customer = await prisma.premiumCustomer.update({
        where: {
          shopifyId: customerId
        },
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
          email: email ?? null,
          coins: 500
        }
      });

    }

    console.log("💰 Total coins:", customer.coins);

    /* -----------------------
       FIND RULE
    ----------------------- */

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

    if (!rule) {

      console.log("No rule matched");

      return new Response(JSON.stringify({
        success: true,
        coins: customer.coins
      }), {
        headers: { "Content-Type": "application/json" }
      });

    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount:", discountAmount);

    /* -----------------------
       DISCOUNT CODE
    ----------------------- */

    const discountCode = `VIP-${customerId}`;

    console.log("🏷 Creating discount:", discountCode);

    /* -----------------------
       CREATE DISCOUNT
    ----------------------- */

    const result = await shopifyGraphQL(

      `mutation discountCreate($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          userErrors {
            field
            message
          }
        }
      }`,

      {
        input: {

          title: discountCode,

          code: discountCode,

          startsAt: new Date().toISOString(),

          customerSelection: {
            customers: {
              add: [shopifyCustomerId]
            }
          },

          customerGets: {

            items: { all: true },

            value: {
              discountAmount: {
                amount: discountAmount.toString(),
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

    );

    console.log("📦 Shopify result:", result);

    /* -----------------------
       RESPONSE
    ----------------------- */

    return new Response(JSON.stringify({

      success: true,
      coins: customer.coins,
      discount: discountAmount,
      code: discountCode

    }), {

      headers: {
        "Content-Type": "application/json"
      }

    });

  } catch (error) {

    console.error("❌ Premium loyalty error:", error);

    return new Response(JSON.stringify({
      error: "Server error"
    }), { status: 500 });

  }

};