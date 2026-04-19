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
      return jsonResponse(false, "Shop missing");
    }

    console.log("👉 ACTION:", actionType);

    switch (actionType) {
      case "SIGNUP":
        return await handleSignup(body, shop);

      case "GET_CUSTOMER":
        return await getCustomerData(body, shop);

      case "UPDATE_DISCOUNT":
        return await updateDiscount(body, shop);

      case "TRACK_VISIT":
        return await trackVisit(body, shop);

      default:
        return jsonResponse(false, "Invalid action");
    }

  } catch (error) {
    console.error("❌ Proxy Error:", error);
    return jsonResponse(false, "Server error", 500);
  }
}

/* ========================================================
   COMMON RESPONSE
======================================================== */
function jsonResponse(success, message, status = 200, extra = {}) {
  return new Response(
    JSON.stringify({ success, message, ...extra }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

/* ========================================================
   GET SHOPIFY ADMIN CLIENT
======================================================== */
async function getAdminClient(shop) {
  const session = await prisma.session.findFirst({
    where: { shop }
  });

  if (!session) throw new Error("Session not found");

  return {
    accessToken: session.accessToken,
    graphql: async (query, variables = {}) => {
      return fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": session.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
    }
  };
}

/* ========================================================
   SIGNUP ACTION
======================================================== */
async function handleSignup(body, shop) {
  const { first_name, last_name, email, birthday, password, referral } = body;

  const admin = await getAdminClient(shop);

  /* -------- Referral Code -------- */
  const generateReferralCode = () => {
    return (
      first_name.substring(0, 3).toUpperCase() +
      Math.random().toString(36).substring(2, 7).toUpperCase()
    );
  };

  const referralCode = generateReferralCode();

  const signInWithReferral = referral && referral.trim() !== "";
  const signInReferralCode = signInWithReferral ? referral : null;

  /* -------- Create Shopify Customer -------- */
  const customerRes = await fetch(
    `https://${shop}/admin/api/2024-01/customers.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": admin.accessToken,
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
    console.log("❌ Customer creation failed", customerData);
    return jsonResponse(false, "Customer creation failed");
  }

  const shopifyCustomerIdReal = customerData.customer.admin_graphql_api_id;
  const shopifyCustomerId = shopifyCustomerIdReal.split("/").pop();

  console.log("✅ Customer Created:", shopifyCustomerId);

  /* -------- Better Discount Code -------- */
  const discountCode = "PTS-" + shopifyCustomerId.slice(-6);

  /* -------- Store in DB -------- */
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
      signInWithReferral,
      signInReferralCode,
      lastVisit: new Date()
    }
  });

  /* -------- Signup Points -------- */
  await addCustomerPoints_regular({
    shop,
    shopifyId: shopifyCustomerId,
    points: 500,
    type: "EARN",
    description: "Signup bonus",
  });

  /* -------- Referral Reward -------- */
  if (signInWithReferral && signInReferralCode) {
    const referrer = await prisma.rewardCustomer.findFirst({
      where: { referralCode: signInReferralCode }
    });

    if (referrer) {
      await prisma.rewardCustomer.update({
        where: { id: referrer.id },
        data: { points: referrer.points + 200 }
      });

      await addCustomerPoints_regular({
        shop,
        shopifyId: referrer.shopifyId,
        points: 200,
        type: "REFERRAL",
        description: "Referral signup reward",
        referralCode: signInReferralCode
      });

      console.log("🎉 Referrer rewarded");
    }
  }

  /* -------- Get Rule -------- */
  const rule = await prisma.regularPointRule.findFirst({
    where: { points: { lte: customer.points } },
    orderBy: { points: "desc" }
  });

  const discountAmount = rule?.discount || 0;

  /* -------- Create Discount -------- */
  await admin.graphql(
    `mutation ($input: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        title: discountCode,
        code: discountCode,
        startsAt: new Date().toISOString(),
        customerSelection: {
          customers: { add: [shopifyCustomerIdReal] }
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
  );

  return new Response(JSON.stringify({
    success: true,
    points: customer.points,
    discount: discountCode,
    discountAmount,
    referralCode
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

/* ========================================================
   GET CUSTOMER
======================================================== */
async function getCustomerData(body, shop) {
  const { email } = body;

  const customer = await prisma.rewardCustomer.findFirst({
    where: { email, shop }
  });

  if (!customer) {
    return jsonResponse(false, "Customer not found");
  }

  return new Response(JSON.stringify({
    success: true,
    customer
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

/* ========================================================
   UPDATE DISCOUNT
======================================================== */
async function updateDiscount(body, shop) {
  const { email } = body;

  const customer = await prisma.rewardCustomer.findFirst({
    where: { email, shop }
  });

  if (!customer) return jsonResponse(false, "Customer not found");

  const rule = await prisma.regularPointRule.findFirst({
    where: { points: { lte: customer.points } },
    orderBy: { points: "desc" }
  });

  const discountAmount = rule?.discount || 0;

  await prisma.rewardCustomer.update({
    where: { id: customer.id },
    data: { discountValue: discountAmount }
  });

  return jsonResponse(true, "Discount updated", 200, { discountAmount });
}

/* ========================================================
   TRACK VISIT
======================================================== */
async function trackVisit(body, shop) {
  const { email } = body;

  await prisma.rewardCustomer.updateMany({
    where: { email, shop },
    data: { lastVisit: new Date() }
  });

  return jsonResponse(true, "Visit tracked");
}