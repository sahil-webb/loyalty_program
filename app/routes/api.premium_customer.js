import { PrismaClient } from "@prisma/client";
import { shopify } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API triggered");

    const body = await request.json();
    console.log("📩 Incoming data:", body);

    const secret = body.secret;
    const email = body.email;
    const rawCustomerId = body.customer_id;
    const shop = body.shop;

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

    console.log("👤 Shopify customer:", customerId);

    /* -----------------------
       LOAD OFFLINE SESSION
    ------------------------*/

    const session = await shopify.sessionStorage.loadSession(
      `offline_${shop}`
    );

    if (!session) {
      console.log("❌ No offline session found");
      return new Response("No session", { status: 500 });
    }

    const client = new shopify.clients.Graphql({ session });

    console.log("✅ Admin client ready");

    /* -----------------------
       CUSTOMER DB LOGIC
    ------------------------*/

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email }
    });

    if (customer) {

      console.log("➕ Adding coins");

      customer = await prisma.premiumCustomer.update({
        where: { email },
        data: {
          coins: {
            increment: 500
          }
        }
      });

    } else {

      console.log("🆕 Creating customer");

      customer = await prisma.premiumCustomer.create({
        data: {
          shopifyId: String(customerId),
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
        points: { lte: customer.coins }
      },
      orderBy: {
        points: "desc"
      }
    });

    if (!rule) {
      console.log("⚠️ No rule matched");
      return new Response(JSON.stringify({ success: true }));
    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount rule:", discountAmount);

    const discountCode = `VIP-${customerId}`;

    /* -----------------------
       CHECK DISCOUNT
    ------------------------*/

    const check = await client.query({
      data: {
        query: `
          query {
            codeDiscountNodes(first:1, query:"code:${discountCode}") {
              edges {
                node { id }
              }
            }
          }
        `
      }
    });

    const discountNode =
      check.body.data.codeDiscountNodes.edges[0]?.node;

    console.log("🔍 Discount node:", discountNode);

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    if (!discountNode) {

      console.log("➕ Creating discount");

      await client.query({
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

    } else {

      console.log("✏️ Updating discount");

      await client.query({
        data: {
          query: `
            mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
              discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
                userErrors { message }
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

    }

    console.log("🎉 Done");

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