import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    /* -----------------------
       GET SHOPIFY ADMIN CLIENT
    ------------------------*/
    const { admin } = await authenticate.admin(request);

    const body = await request.json();

    const secret = body.secret;
    const email = body.email;

    /* -----------------------
       VALIDATE SECRET
    ------------------------*/

    if (secret !== "premium_customer") {
      return new Response("Unauthorized", { status: 401 });
    }

    /* -----------------------
       EXTRACT CUSTOMER ID
    ------------------------*/

    let rawCustomerId = body.customer_id;

    if (!rawCustomerId) {
      return new Response("Customer ID missing", { status: 400 });
    }

    const customerId = rawCustomerId.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    /* -----------------------
       CREATE OR UPDATE CUSTOMER
    ------------------------*/

    let customer;

    const existingCustomer = await prisma.premiumCustomer.findUnique({
      where: {
        shopifyId: String(customerId)
      }
    });

    if (existingCustomer) {

      customer = await prisma.premiumCustomer.update({
        where: {
          shopifyId: String(customerId)
        },
        data: {
          coins: {
            increment: 500
          }
        }
      });

    } else {

      customer = await prisma.premiumCustomer.create({
        data: {
          shopifyId: String(customerId),
          email: email,
          coins: 500
        }
      });

    }

    const coins = customer.coins;

    /* -----------------------
       FIND MATCHING POINT RULE
    ------------------------*/

    const rule = await prisma.premiumPointRule.findFirst({
      where: {
        points: {
          lte: coins
        }
      },
      orderBy: {
        points: "desc"
      }
    });

    if (!rule) {
      console.log("No discount rule found");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const discountAmount = rule.discount;

    /* -----------------------
       DISCOUNT CODE NAME
    ------------------------*/

    const discountCode = `VIP-${customerId}`;

    /* -----------------------
       CHECK EXISTING DISCOUNT
    ------------------------*/

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
      discountData.data.codeDiscountNodes.edges[0]?.node;

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    if (!discountNode) {

      console.log("➕ Creating discount");

      await admin.graphql(
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

    } else {

      /* -----------------------
         UPDATE DISCOUNT
      ------------------------*/

      console.log("✏️ Updating discount");

      await admin.graphql(
        `
        mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
            userErrors { message }
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

    }

    return new Response(
      JSON.stringify({
        success: true,
        coins: coins,
        discount: discountAmount,
        code: discountCode
      }),
      { status: 200 }
    );

  } catch (error) {

    console.error("Premium loyalty error:", error);

    return new Response(
      JSON.stringify({
        error: "Server error"
      }),
      { status: 500 }
    );

  }
};