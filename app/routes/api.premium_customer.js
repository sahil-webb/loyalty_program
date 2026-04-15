import { PrismaClient } from "@prisma/client";
import { addCustomerPoints } from "./api.pointsLedger.js";

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
GENERATE REFERRAL CODE
======================================================== */

async function generateReferralCode() {

  let code;
  let exists = true;

  while (exists) {

    code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const existing = await prisma.premiumCustomer.findFirst({
      where: { referralCode: code }
    });

    if (!existing) exists = false;

  }

  return code;

}

/* ========================================================
FLOW API
======================================================== */

export const action = async ({ request }) => {

  try {

    console.log("🚀 Flow API triggered");

    const body = await request.json();

    const { email, customer_id, secret } = body;

    if (secret !== FLOW_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!customer_id) {
      return new Response("Missing customer id", { status: 400 });
    }

    const customerId = customer_id.split("/").pop();

    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    let customer = await prisma.premiumCustomer.findUnique({
      where: {
        shop_shopifyId: {
          shop: SHOP,
          shopifyId: customerId
        }
      }
    });

    /* ========================================================
       CREATE OR UPDATE CUSTOMER
    ======================================================== */

    if (!customer) {

      console.log("🆕 Creating new customer");

      const referralCode = await generateReferralCode();

      customer = await prisma.premiumCustomer.create({
        data: {
          shop: SHOP,
          shopifyId: customerId,
          email: email ?? null,

          coins: 0,
          tier: "insider",

          referralCode: referralCode,
          signInWithReferral: false,
          signInReferralCode: null,
          birthday: new Date("2002-04-15T00:00:00.000Z"),
          discountCode: null,
          lastVisitReward: null
        }
      });

    }

    /* ========================================================
       ADD POINTS USING LEDGER
    ======================================================== */

    customer = await addCustomerPoints({

      shop: SHOP,
      shopifyId: customerId,
      points: 500,
      type: "EARN",
      description: "Signup reward"

    });

    console.log("💰 Total coins:", customer.coins);

    /* ========================================================
       FIND RULE
    ======================================================== */

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

      return new Response(JSON.stringify({
        success: true,
        coins: customer.coins
      }), {
        headers: { "Content-Type": "application/json" }
      });

    }

    const discountAmount = rule.discount;

    const discountCode = `VIP-${customerId}`;

    /* ========================================================
       CREATE DISCOUNT
    ======================================================== */

    await shopifyGraphQL(

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

    await prisma.premiumCustomer.update({
      where: {
        shop_shopifyId: {
          shop: SHOP,
          shopifyId: customerId
        }
      },
      data: {
        discountCode: discountCode
      }
    });

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

    console.error("❌ Loyalty error:", error);

    return new Response(JSON.stringify({
      error: "Server error"
    }), { status: 500 });

  }

};