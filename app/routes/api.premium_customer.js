import { PrismaClient } from "@prisma/client";
import { shopify } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 Flow API triggered");

    const body = await request.json();

    const { email, customer_id, shop, secret } = body;

    if (secret !== "premium_customer") {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!email || !customer_id || !shop) {
      return new Response("Missing data", { status: 400 });
    }

    /* -------------------------
       CUSTOMER ID
    -------------------------- */

    const id = customer_id.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${id}`;

    console.log("Customer:", id);

    /* -------------------------
       CREATE / UPDATE CUSTOMER
    -------------------------- */

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email }
    });

    if (customer) {

      console.log("Customer exists → add 500 points");

      customer = await prisma.premiumCustomer.update({
        where: { email },
        data: {
          coins: {
            increment: 500
          }
        }
      });

    } else {

      console.log("Creating new customer");

      customer = await prisma.premiumCustomer.create({
        data: {
          email,
          shopifyId: id,
          coins: 500
        }
      });

    }

    console.log("Total coins:", customer.coins);

    /* -------------------------
       FIND DISCOUNT RULE
    -------------------------- */

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
        success: true
      }), {
        headers: { "Content-Type": "application/json" }
      });

    }

    const discountAmount = rule.discount;

    console.log("Discount:", discountAmount);

    /* -------------------------
       AUTHENTICATE SHOPIFY
    -------------------------- */

    const session = await prisma.session.findFirst({
      where: { shop }
    });

    if (!session) {
      throw new Error("Shop not installed");
    }

    const admin = new shopify.clients.Graphql({ session });

    /* -------------------------
       DISCOUNT CODE
    -------------------------- */

    const discountCode = `VIP-${id}`;

    console.log("Discount code:", discountCode);

    /* -------------------------
       CREATE DISCOUNT
    -------------------------- */

    const response = await admin.query({
      data: {
        query: `
        mutation discountCreate($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            userErrors {
              field
              message
            }
          }
        }
        `,
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

            usageLimit: 1
          }
        }
      }
    });

    const result = response.body;

    console.log("Shopify result:", result);

    return new Response(JSON.stringify({

      success: true,
      coins: customer.coins,
      discount: discountAmount,
      code: discountCode

    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {

    console.error("❌ Error:", error);

    return new Response(JSON.stringify({
      error: "Server error"
    }), { status: 500 });

  }
};