import { PrismaClient } from "@prisma/client";
import prisma from "../db.server";
import { shopify } from "../shopify.server";

const db = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API triggered");

    const body = await request.json();

    console.log("📩 Incoming data:", body);

    const secret = body.secret;
    const email = body.email;
    const rawCustomerId = body.customer_id;

    if (secret !== "premium_customer") {
      console.log("❌ Invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }

    if (!email) {
      console.log("❌ Email missing");
      return new Response("Email missing", { status: 400 });
    }

    const customerId = rawCustomerId?.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Shopify customer ID:", customerId);
    console.log("📧 Email:", email);

    /* -----------------------------
       GET OFFLINE ADMIN SESSION
    ------------------------------*/

    console.log("🔑 Fetching offline Shopify session");

    const session = await prisma.session.findFirst({
      where: { isOnline: false }
    });

    if (!session) {
      console.log("❌ No Shopify session found");
      throw new Error("Offline session missing");
    }

    const admin = new shopify.clients.Graphql({ session });

    console.log("✅ Admin client created");

    /* -----------------------------
       CHECK CUSTOMER IN DATABASE
    ------------------------------*/

    console.log("🔎 Checking customer in DB");

    let customer = await db.premiumCustomer.findUnique({
      where: { email: email }
    });

    if (customer) {

      console.log("➕ Customer exists → adding 500 coins");

      customer = await db.premiumCustomer.update({
        where: { email: email },
        data: {
          coins: {
            increment: 500
          }
        }
      });

    } else {

      console.log("🆕 Creating new customer");

      customer = await db.premiumCustomer.create({
        data: {
          shopifyId: String(customerId),
          email: email,
          coins: 500
        }
      });

    }

    console.log("💰 Customer coins:", customer.coins);

    /* -----------------------------
       FIND DISCOUNT RULE
    ------------------------------*/

    console.log("📊 Finding rule from PremiumPointRule");

    const rule = await db.premiumPointRule.findFirst({
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
      console.log("⚠️ No rule matched");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const discountAmount = rule.discount;

    console.log("🎯 Matched rule:", rule.points, "→ $", discountAmount);

    /* -----------------------------
       DISCOUNT CODE
    ------------------------------*/

    const discountCode = `VIP-${customerId}`;

    console.log("🔍 Checking existing discount:", discountCode);

    const checkDiscount = await admin.query({
      data: {
        query: `
          query {
            codeDiscountNodes(first:1, query:"code:${discountCode}") {
              edges {
                node {
                  id
                }
              }
            }
          }
        `
      }
    });

    const discountNode =
      checkDiscount?.body?.data?.codeDiscountNodes?.edges[0]?.node;

    console.log("📦 Existing discount:", discountNode);

    /* -----------------------------
       CREATE DISCOUNT
    ------------------------------*/

    if (!discountNode) {

      console.log("➕ Creating discount");

      const result = await admin.query({
        data: {
          query: `
            mutation ($input: DiscountCodeBasicInput!) {
              discountCodeBasicCreate(basicCodeDiscount: $input) {
                userErrors {
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
              appliesOncePerCustomer: false,

              combinesWith: {
                shippingDiscounts: true,
                orderDiscounts: false,
                productDiscounts: false
              }
            }
          }
        }
      });

      console.log("✅ Discount create result:", result.body);

    } else {

      console.log("✏️ Updating discount");

      const result = await admin.query({
        data: {
          query: `
            mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
              discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
                userErrors {
                  message
                }
              }
            }
          `,
          variables: {
            id: discountNode.id,
            input: {
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
        }
      });

      console.log("✅ Discount update result:", result.body);

    }

    console.log("🎉 Process finished");

    return new Response(
      JSON.stringify({
        success: true,
        coins: customer.coins,
        discount: discountAmount
      }),
      { status: 200 }
    );

  } catch (error) {

    console.error("❌ Premium loyalty error:", error);

    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500 }
    );

  }
};