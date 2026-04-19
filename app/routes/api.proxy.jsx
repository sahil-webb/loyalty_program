import prisma from "../db.server";
import { addCustomerPoints_regular } from "./api.pointsLedger_regular.js";

export async function action({ request }) {
  try {
    console.log("🚀 Proxy Triggered");

    const body = await request.json();
    const { actionType } = body;

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return new Response(JSON.stringify({
        success: false,
        message: "Shop missing"
      }));
    }

    console.log("👉 ACTION:", actionType);

    switch (actionType) {
      case "SIGNUP":
        return await handleSignup(body, shop);

      case "GET_CUSTOMER":
        return await getCustomer(body, shop);

      case "UPDATE_DISCOUNT":
        return await updateDiscount(body, shop);

      case "TRACK_VISIT":
        return await trackVisit(body, shop);

      default:
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid action"
        }));
    }

  } catch (error) {
    console.error("❌ Proxy Error:", error);

    return new Response(JSON.stringify({
      success: false,
      message: "Server error"
    }), { status: 500 });
  }
}

/* ========================================================
   SIGNUP (YOUR ORIGINAL LOGIC FIXED)
======================================================== */
async function handleSignup(body, shop) {
  const { first_name, last_name, email, birthday, password, referral } = body;

  /* -------- FIXED BOOLEAN -------- */
  const signInWithReferral = !!(referral && referral.trim() !== "");
  const signInReferralCode = signInWithReferral ? referral : null;

  /* -------- REFERRAL CODE -------- */
  const generateReferralCode = () => {
    const namePart = first_name.substring(0, 3).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    return namePart + randomPart;
  };

  const referralCode = generateReferralCode();

  /* -------- SESSION -------- */
  const session = await prisma.session.findFirst({
    where: { shop }
  });

  if (!session) {
    return new Response(JSON.stringify({
      success: false,
      message: "Session not found"
    }));
  }

  const accessToken = session.accessToken;

  /* -------- CREATE CUSTOMER -------- */
  const customerRes = await fetch(
    `https://${shop}/admin/api/2024-01/customers.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: {
          first_name,
          last_name,
          email,
          password,
          password_confirmation: password,
          verified_email: true,
          tags: "rsloyalty",
        },
      }),
    }
  );

  const customerData = await customerRes.json();

  if (!customerData.customer) {
    return new Response(JSON.stringify({
      success: false,
      message: "Customer creation failed"
    }));
  }

  const shopifyCustomerIdreal = customerData.customer.admin_graphql_api_id;
  const shopifyCustomerId = shopifyCustomerIdreal.split("/").pop();

  console.log("✅ Customer Created:", shopifyCustomerId);

  /* -------- SAME DISCOUNT LOGIC -------- */
  const discountCode = "PTS-" + email.split("@")[0].toUpperCase();

  /* -------- STORE IN DB -------- */
  const customer = await prisma.rewardCustomer.create({
    data: {
      shop,
      shopifyId: shopifyCustomerId,
      firstName: first_name,
      lastName: last_name,
      email,
      birthday,
      points: 500,
      discountCode,
      referralCode,
      signInWithReferral, // ✅ FIXED
      signInReferralCode,
      lastVisit: new Date()
    }
  });

  /* -------- SIGNUP BONUS -------- */
  await addCustomerPoints_regular({
    shop,
    shopifyId: shopifyCustomerId,
    points: 500,
    type: "EARN",
    description: "Signup bonus",
  });

  /* -------- REFERRAL REWARD -------- */
  if (signInWithReferral && signInReferralCode) {
    const referrer = await prisma.rewardCustomer.findFirst({
      where: { referralCode: signInReferralCode }
    });

    if (referrer) {
      await prisma.rewardCustomer.update({
        where: { id: referrer.id },
        data: {
          points: referrer.points + 200
        }
      });

      await addCustomerPoints_regular({
        shop,
        shopifyId: referrer.shopifyId,
        points: 200,
        type: "REFERRAL",
        description: "Referral signup reward",
        referralCode: signInReferralCode
      });
    }
  }

  /* -------- RULE -------- */
  const rule = await prisma.regularPointRule.findFirst({
    where: {
      points: { lte: 500 }
    },
    orderBy: {
      points: "desc"
    }
  });

  const discountAmount = rule ? rule.discount : 0;

  /* -------- CREATE DISCOUNT -------- */
  await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        mutation ($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            userErrors { field message }
          }
        }
      `,
      variables: {
        input: {
          title: discountCode,
          code: discountCode,
          startsAt: new Date().toISOString(),
          customerSelection: {
            customers: { add: [shopifyCustomerIdreal] }
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
    })
  });

  return new Response(JSON.stringify({
    success: true,
    points: 500,
    discount: discountCode,
    discountAmount,
    referralCode
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

/* ========================================================
   OTHER ACTIONS
======================================================== */

async function getCustomer(body, shop) {
  const { email } = body;

  const customer = await prisma.rewardCustomer.findFirst({
    where: { email, shop }
  });

  return new Response(JSON.stringify({
    success: true,
    customer
  }));
}

async function updateDiscount(body, shop) {
  const { email } = body;

  const customer = await prisma.rewardCustomer.findFirst({
    where: { email, shop }
  });

  if (!customer) return new Response(JSON.stringify({ success: false }));

  const rule = await prisma.regularPointRule.findFirst({
    where: { points: { lte: customer.points } },
    orderBy: { points: "desc" }
  });

  const discountAmount = rule?.discount || 0;

  return new Response(JSON.stringify({
    success: true,
    discountAmount
  }));
}

async function trackVisit(body, shop) {
  const { email } = body;

  await prisma.rewardCustomer.updateMany({
    where: { email, shop },
    data: { lastVisit: new Date() }
  });

  return new Response(JSON.stringify({ success: true }));
}