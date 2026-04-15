import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
========================================================
REWARD CUSTOMER ORDER POINTS (1₹ = 1 POINT)
========================================================
*/

export async function addRewardCustomerOrderPoints(data) {
  try {
    console.log("🚀 Function triggered");

    let { email, amountSpent } = data;

    console.log("📦 Raw Incoming Data:", data);

    // ✅ Validate input
    if (!email || !amountSpent) {
      console.log("❌ Missing email or amountSpent");
      return;
    }

    // ✅ Clean email
    email = email.trim().toLowerCase();

    console.log("📧 Clean Email:", email);

    // ✅ Convert amount to number
    amountSpent = parseFloat(amountSpent);

    console.log("💰 Parsed Amount:", amountSpent);

    if (isNaN(amountSpent)) {
      console.log("❌ Invalid amountSpent:", amountSpent);
      return;
    }

    // ✅ 1:1 logic
    const earnedPoints = Math.floor(amountSpent);

    console.log("🎁 Points to Add:", earnedPoints);

    // ✅ Find customer by email
    console.log("🔍 Searching customer...");

    const customer = await prisma.rewardCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("❌ Customer NOT FOUND for email:", email);
      return;
    }

    console.log("✅ Customer Found:");
    console.log("🆔 ID:", customer.id);
    console.log("📧 Email:", customer.email);
    console.log("💰 Current Points:", customer.points);

    // ✅ Update points
    console.log("⬆️ Updating points...");

    const updatedCustomer = await prisma.rewardCustomer.update({
      where: {
        id: customer.id
      },
      data: {
        points: {
          increment: earnedPoints
        }
      }
    });

    console.log("✅ Points Updated Successfully");
    console.log("🎁 Points Added:", earnedPoints);
    console.log("💰 New Total Points:", updatedCustomer.points);

    return updatedCustomer;

  } catch (error) {
    console.error("🔥 ERROR in addRewardCustomerOrderPoints:");
    console.error(error);
  }
}