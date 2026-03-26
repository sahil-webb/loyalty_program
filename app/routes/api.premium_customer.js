import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API triggered");

    const { admin } = await authenticate.admin(request);

    const body = await request.json();

    const secret = body.secret;
    const email = body.email;
    const rawCustomerId = body.customer_id;

    console.log("📩 Incoming data:", body);

    /* -----------------------
       VALIDATE SECRET
    ------------------------*/

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

    console.log("👤 Shopify Customer ID:", customerId);
    console.log("📧 Email:", email);

    /* -----------------------
       CHECK CUSTOMER IN DB
    ------------------------*/

    console.log("🔎 Checking if customer exists");

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email: email }
    });

    /* -----------------------
       ADD OR CREATE CUSTOMER
    ------------------------*/

    if (customer) {

      console.log("➕ Customer exists, adding 500 coins");

      customer = await prisma.premiumCustomer.update({
        where: { email: email },
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
          shopifyId: String(customerId),
          email: email,
          coins: 500
        }
      });

    }

    console.log("💰 Customer coins:", customer.coins);

    /* -----------------------
       FIND DISCOUNT RULE
    ------------------------*/

    console.log("📊 Finding matching rule");

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
      console.log("⚠️ No discount rule matched");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount rule matched:", discountAmount);

    /* -----------------------
       CREATE DISCOUNT CODE
    ------------------------*/

    const discountCode = `VIP-${customerId}`;

    console.log("🔍 Checking existing discount:", discountCode);

    const discountCheck = await admin.graphql(`
      query {
        codeDiscountNodes(first:1, query:"code:${discountCode}") {
          edges {
            node {
              id
            }
          }
        }
      }
    `);

    const discountData = await discountCheck.json();

    const discountNode =
      discountData?.data?.codeDiscountNodes?.edges[0]?.node;

    console.log("📦 Existing discount node:", discountNode);

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    if (!discountNode) {

      console.log("➕ Creating discount");

      const result = await admin.graphql(
        `
        mutation ($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            userErrors {
              message
            }
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
              appliesOncePerCustomer: false,

              combinesWith: {
                shippingDiscounts: true,
                orderDiscounts: false,
                productDiscounts: false
              }
            }
          }
        }
      );

      console.log("✅ Discount create response:", await result.json());

    } else {

      console.log("✏️ Updating discount");

      const result = await admin.graphql(
        `
        mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
            userErrors {
              message
            }
          }
        }
        `,
        {
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
      );

      console.log("✅ Discount update response:", await result.json());

    }

    console.log("🎉 Process completed");

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