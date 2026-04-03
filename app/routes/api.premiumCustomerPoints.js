import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function premiumCustomerReward(data) {

  try {

    const { email, amountSpent } = data;

    if (!email || !amountSpent) {
      console.log("Missing email or amountSpent");
      return;
    }

    const earnedCoins = Math.floor(amountSpent * 2);

    const customer = await prisma.premiumCustomer.findFirst({
      where: {
        email: email
      }
    });

    if (!customer) {
      console.log("Premium customer not found");
      return;
    }

    await prisma.premiumCustomer.update({
      where: {
        id: customer.id
      },
      data: {
        coins: {
          increment: earnedCoins
        }
      }
    });

    console.log(`Added ${earnedCoins} coins to ${email}`);

  } catch (error) {
    console.error("Premium reward error:", error);
  }

}