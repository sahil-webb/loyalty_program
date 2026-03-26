import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {

  try {

    console.log("🚀 Flow API triggered");

    const body = await request.json();

    console.log("📩 Incoming body:", body);

    const { email, customer_id, shop, secret } = body;

    /* -----------------------
       SECRET VALIDATION
    ----------------------- */

    if (secret !== "premium_customer") {

      console.log("❌ Invalid secret");

      return new Response("Unauthorized", { status: 401 });

    }

    if (!email || !customer_id || !shop) {

      console.log("❌ Missing required data");

      return new Response("Missing data", { status: 400 });

    }

    /* -----------------------
       AUTHENTICATE SHOPIFY
    ----------------------- */

    console.log("🔐 Authenticating Shopify Admin");

    const { admin } = await authenticate.admin(request, { shop });

    console.log("✅ Admin authenticated");

    /* -----------------------
       CUSTOMER ID FORMAT
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

      console.log("🆕 Creating new customer");

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

      console.log("⚠️ No rule found");

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

    const response = await admin.graphql(

      `mutation discountCreate($input: DiscountCodeBasicInput!) {

        discountCodeBasicCreate(basicCodeDiscount: $input) {

          userErrors {
            field
            message
          }

        }

      }`,

      {
        variables: {

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

      }

    );

    const result = await response.json();

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