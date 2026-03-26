import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ========================================================
   ENV VARIABLES
======================================================== */

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const FLOW_SECRET = process.env.FLOW_SECRET;

if (!SHOP || !ACCESS_TOKEN) {
  throw new Error("❌ Missing Shopify environment variables");
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
   API ROUTE
======================================================== */

export const action = async ({ request }) => {

  try {

    console.log("🚀 Flow API triggered");

    const body = await request.json();

    console.log("📩 Incoming body:", body);

    const { email, customer_id, shop, secret } = body;

    /* -----------------------
       SECRET VALIDATION
    ----------------------- */

    if (secret !== FLOW_SECRET) {

      console.log("❌ Invalid secret");

      return new Response("Unauthorized", { status: 401 });

    }

    if (!email || !customer_id) {

      console.log("❌ Missing required fields");

      return new Response("Missing data", { status: 400 });

    }

    /* -----------------------
       CUSTOMER ID
    ----------------------- */

    const customerId = customer_id.split("/").pop();

    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Customer:", customerId);

    /* -----------------------
       CREATE / UPDATE CUSTOMER
    ----------------------- */

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email }
    });

    if (customer) {

      console.log("➕ Existing customer → +500 coins");

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
          email,
          shopifyId: customerId,
          coins: 500
        }
      });

    }

    console.log("💰 Customer coins:", customer.coins);

    /* -----------------------
       FIND DISCOUNT RULE
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

      console.log("⚠️ No discount rule found");

      return new Response(JSON.stringify({
        success: true,
        coins: customer.coins
      }), {
        headers: { "Content-Type": "application/json" }
      });

    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount rule matched:", discountAmount);

    /* -----------------------
       DISCOUNT CODE
    ----------------------- */

    const discountCode = `VIP-${customerId}`;

    console.log("🏷 Discount code:", discountCode);

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

            items: {
              all: true
            },

            value: {

              discountAmount: {

                amount: discountAmount.toString(),

                appliesOnEachItem: false

              }

            }

          },

          usageLimit: 1,

          combinesWith: {

            shippingDiscounts: true,
            orderDiscounts: false,
            productDiscounts: false

          }

        }
      }

    );

    console.log("📦 Shopify response:", result);

    /* -----------------------
       RETURN SUCCESS
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