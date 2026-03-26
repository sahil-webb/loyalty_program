import { PrismaClient } from "@prisma/client";
import { shopify } from "../shopify.server";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    console.log("🚀 API STARTED");

    const body = await request.json();
    console.log("📩 Body:", body);

    const { secret, email, customer_id, shop } = body;

    /* -----------------------
       VALIDATE SECRET
    ------------------------*/

    if (secret !== "premium_customer") {
      console.log("❌ Invalid secret");
      return new Response("Unauthorized", { status: 401 });
    }

    if (!shop) {
      console.log("❌ Shop missing in request");
      return new Response("Shop missing", { status: 400 });
    }

    /* -----------------------
       LOAD OFFLINE SESSION
    ------------------------*/

    console.log("🔐 Loading offline session for shop:", shop);

    const session = await shopify.sessionStorage.loadSession(
      `offline_${shop}`
    );

    if (!session) {
      console.log("❌ No offline session found");
      return new Response("No session", { status: 500 });
    }

    const client = new shopify.clients.Graphql({ session });

    console.log("✅ Shopify admin client ready");

    /* -----------------------
       CUSTOMER ID
    ------------------------*/

    const customerId = customer_id.split("/").pop();
    const shopifyCustomerId = `gid://shopify/Customer/${customerId}`;

    console.log("👤 Customer:", customerId);

    /* -----------------------
       CREATE / UPDATE CUSTOMER
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
      where: {
        points: { lte: customer.coins }
      },
      orderBy: { points: "desc" }
    });

    console.log("📊 Rule:", rule);

    if (!rule) {
      console.log("⚠️ No rule found");
      return new Response(JSON.stringify({ success: true }));
    }

    const discountAmount = rule.discount;
    const discountCode = `VIP-${customerId}`;

    console.log("🎯 Discount:", discountAmount);

    /* -----------------------
       CREATE DISCOUNT
    ------------------------*/

    console.log("➕ Creating discount");

    const result = await client.query({
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

    console.log("✅ Discount response:", result.body);

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