import { PrismaClient } from "@prisma/client";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API STARTED");

    const body = await request.json();
    console.log("📩 Body:", body);

    const { customer_id, email, shop, secret } = body;

    if (secret !== "premium_customer") {
      console.log("❌ Invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }

    if (!shop) {
      console.log("❌ Shop missing");
      return new Response("Shop missing", { status: 400 });
    }

    console.log("🏪 Shop:", shop);

    /* -----------------------
       CREATE SHOPIFY CLIENT
    ------------------------*/

    const shopify = shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecretKey: process.env.SHOPIFY_API_SECRET,
      scopes: process.env.SCOPES.split(","),
      hostName: process.env.HOST.replace(/^https?:\/\//, ""),
      apiVersion: LATEST_API_VERSION,
      isEmbeddedApp: true,
    });

    const session = {
      shop,
      accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    };

    const client = new shopify.clients.Graphql({ session });

    console.log("✅ Shopify GraphQL client created");

    /* -----------------------
       CUSTOMER ID
    ------------------------*/

    const customerId = customer_id.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Customer:", customerId);

    /* -----------------------
       CREATE OR UPDATE CUSTOMER
    ------------------------*/

    let customer = await prisma.premiumCustomer.findUnique({
      where: { email }
    });

    if (customer) {

      console.log("➕ Adding 500 coins");

      customer = await prisma.premiumCustomer.update({
        where: { email },
        data: {
          coins: { increment: 500 }
        }
      });

    } else {

      console.log("🆕 Creating customer");

      customer = await prisma.premiumCustomer.create({
        data: {
          shopifyId: customerId,
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
      where: { points: { lte: customer.coins } },
      orderBy: { points: "desc" }
    });

    console.log("📊 Rule:", rule);

    if (!rule) {
      console.log("⚠️ No rule matched");
      return new Response(JSON.stringify({ success: true }));
    }

    const discountAmount = rule.discount;
    const discountCode = `VIP-${customerId}`;

    console.log("🎯 Discount:", discountAmount);

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    const response = await client.query({
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
            }
          }
        }
      }
    });

    console.log("📦 Shopify response:", response.body);

    console.log("🎉 DONE");

    return new Response(JSON.stringify({
      success: true,
      coins: customer.coins,
      discount: discountAmount
    }));

  } catch (error) {

    console.error("❌ ERROR:", error);

    return new Response(JSON.stringify({
      error: "Server error"
    }), { status: 500 });

  }
};