import prisma from "../db.server";
import { addCustomerPoints_regular } from "./api.pointsLedger_regular.js";

export async function action({ request }) {
  try {

    console.log("🚀 Customer Signup Proxy Triggered");

    /* -------------------------
       GET REQUEST BODY
    ------------------------- */

    const body = await request.json();
    const { first_name, last_name, email, birthday, password, referral } = body;

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return new Response(JSON.stringify({
        success: false,
        message: "Shop missing"
      }));
    }

    /* -------------------------
       GENERATE REFERRAL CODE
    ------------------------- */

    const generateReferralCode = () => {
      const namePart = first_name.substring(0,3).toUpperCase();
      const randomPart = Math.random().toString(36).substring(2,7).toUpperCase();
      return namePart + randomPart;
    };

    let referralCode = generateReferralCode();
    let signInWithReferral = false;
    let signInReferralCode = null;

    if (referral && referral.trim() !== "") {
      signInWithReferral = true;
      signInReferralCode = referral;
      console.log("🎁 Referral used:", referral);
    } else {
      console.log("➡️ No referral used");
    }

    /* -------------------------
       GET SHOP SESSION
    ------------------------- */

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

    /* -------------------------
       CREATE SHOPIFY CUSTOMER
    ------------------------- */

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
      console.log("❌ Customer creation failed", customerData);

      return new Response(JSON.stringify({
        success: false,
        message: "Customer creation failed"
      }));
    }

    const shopifyCustomerId = customerData.customer.admin_graphql_api_id;

    console.log("✅ Shopify Customer Created:", shopifyCustomerId);

    /* -------------------------
       GENERATE DISCOUNT CODE
    ------------------------- */

    const discountCode =
      "PTS-" + email.split("@")[0].toUpperCase();

    console.log("🎟️ Discount Code:", discountCode);

    /* -------------------------
       STORE CUSTOMER IN PRISMA
    ------------------------- */

    const customer = await prisma.rewardCustomer.create({
      data: {
        shop,
        shopifyId: shopifyCustomerId,
        firstName: first_name,
        lastName: last_name,
        email,
        birthday,
        points: 0,   // IMPORTANT: start with 0
        discountCode,
        referralCode,
        signInWithReferral,
        signInReferralCode
      }
    });

    console.log("📦 Customer Stored in DB");

    /* -------------------------
       ADD SIGNUP POINTS
    ------------------------- */

    const updatedCustomer = await addCustomerPoints_regular({
      shop,
      shopifyId: shopifyCustomerId,
      points: 500,
      type: "EARN",
      description: "Signup bonus reward"
    });

    /* -------------------------
       GIVE REFERRAL REWARD
    ------------------------- */

    if (signInWithReferral && signInReferralCode) {

      const referrer = await prisma.rewardCustomer.findFirst({
        where: {
          referralCode: signInReferralCode
        }
      });

      if (referrer) {

        await prisma.rewardCustomer.update({
          where: {
            id: referrer.id
          },
          data: {
            points: {
              increment: 200
            }
          }
        });

        console.log("🎉 Referrer rewarded with 200 points:", referrer.email);

      } else {

        console.log("⚠️ Referral code not found");

      }

    }

    /* -------------------------
       GET RULE FROM TABLE
    ------------------------- */

    const rule = await prisma.regularPointRule.findFirst({
      where: {
        points: {
          lte: updatedCustomer.points
        }
      },
      orderBy: {
        points: "desc"
      }
    });

    let discountAmount = 0;

    if (rule) {
      discountAmount = rule.discount;
    }

    console.log("🎯 Rule matched:", rule);
    console.log("💰 Discount amount:", discountAmount);

    /* -------------------------
       FINAL RESPONSE
    ------------------------- */

    return new Response(
      JSON.stringify({
        success: true,
        points: updatedCustomer.points,
        discount: discountCode,
        discountAmount,
        referralCode
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {

    console.error("Proxy Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Server error"
      }),
      {
        status: 500
      }
    );

  }
}