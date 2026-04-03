import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function regularCustomerReward(data) {

  try {

    const { email, amountSpent } = data;

    if (!email || !amountSpent) {
      console.log("Missing email or amountSpent");
      return;
    }

    const earnedPoints = Math.floor(amountSpent * 1);

    const customer = await prisma.rewardCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("Customer not found");
      return;
    }

    await prisma.rewardCustomer.update({
      where: {
        id: customer.id
      },
      data: {
        points: {
          increment: earnedPoints
        }
      }
    });

    console.log(`Added ${earnedPoints} points to ${email}`);

  } catch (error) {
    console.error("Regular reward error:", error);
  }

}