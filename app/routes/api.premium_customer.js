import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API STARTED");

    /* -----------------------
       GET SHOPIFY ADMIN CLIENT
    ------------------------*/
    console.log("🔐 Authenticating Shopify admin");

    const { admin } = await authenticate.admin(request);

    console.log("✅ Shopify admin authenticated");

    const body = await request.json();

    console.log("📩 Request body received:", body);

    const secret = body.secret;
    const email = body.email;

    console.log("🔑 Secret:", secret);
    console.log("📧 Email:", email);

    /* -----------------------
       VALIDATE SECRET
    ------------------------*/

    console.log("🔍 Validating secret");

    if (secret !== "premium_customer") {
      console.log("❌ Invalid secret received");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("✅ Secret validated");

    /* -----------------------
       EXTRACT CUSTOMER ID
    ------------------------*/

    console.log("👤 Extracting Shopify customer ID");

    let rawCustomerId = body.customer_id;

    if (!rawCustomerId) {
      console.log("❌ Customer ID missing in request");
      return new Response("Customer ID missing", { status: 400 });
    }

    const customerId = rawCustomerId.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("🆔 Extracted customerId:", customerId);
    console.log("🪪 Shopify GID:", shopifyCustomerId);

    /* -----------------------
       CREATE OR UPDATE CUSTOMER
    ------------------------*/

    console.log("🔎 Checking if customer exists in DB");

    let customer;

    const existingCustomer = await prisma.premiumCustomer.findUnique({
      where: {
        shopifyId: String(customerId)
      }
    });

    console.log("📦 Existing customer result:", existingCustomer);

    if (existingCustomer) {

      console.log("➕ Customer exists → incrementing 500 coins");

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

      console.log("💰 Coins after increment:", customer.coins);

    } else {

      console.log("🆕 Customer not found → creating new entry");

      customer = await prisma.premiumCustomer.create({
        data: {
          shopifyId: String(customerId),
          email: email,
          coins: 500
        }
      });

      console.log("🎉 New customer created:", customer);
    }

    const coins = customer.coins;

    console.log("💳 Total coins now:", coins);

    /* -----------------------
       FIND MATCHING POINT RULE
    ------------------------*/

    console.log("📊 Searching matching discount rule");

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

    console.log("📊 Rule found:", rule);

    if (!rule) {
      console.log("⚠️ No discount rule found for coins:", coins);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const discountAmount = rule.discount;

    console.log("🎯 Discount amount determined:", discountAmount);

    /* -----------------------
       DISCOUNT CODE NAME
    ------------------------*/

    const discountCode = `VIP-${customerId}`;

    console.log("🏷 Discount code generated:", discountCode);

    /* -----------------------
       CHECK EXISTING DISCOUNT
    ------------------------*/

    console.log("🔎 Checking if discount already exists");

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

    console.log("📦 Discount check response:", discountData);

    const discountNode =
      discountData?.data?.codeDiscountNodes?.edges[0]?.node;

    console.log("📦 Existing discount node:", discountNode);

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    if (!discountNode) {

      console.log("➕ Creating new Shopify discount");

      const createResponse = await admin.graphql(
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

      const createResult = await createResponse.json();

      console.log("✅ Discount creation response:", createResult);

    } else {

      /* -----------------------
         UPDATE DISCOUNT
      ------------------------*/

      console.log("✏️ Updating existing discount");

      const updateResponse = await admin.graphql(
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

      const updateResult = await updateResponse.json();

      console.log("✅ Discount update response:", updateResult);

    }

    console.log("🎉 PROCESS COMPLETED SUCCESSFULLY");

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

    console.error("❌ Premium loyalty error:", error);

    return new Response(
      JSON.stringify({
        error: "Server error"
      }),
      { status: 500 }
    );

  }
};