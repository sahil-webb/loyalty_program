import { PrismaClient } from "@prisma/client";
import { updateCustomerDiscounts } from "../helpers/updateCustomerDiscounts";

const prisma = new PrismaClient();

/* GET RULES */

export const loader = async () => {

  const regular = await prisma.regularPointRule.findMany({
    orderBy: { points: "asc" }
  });

  const premium = await prisma.premiumPointRule.findMany({
    orderBy: { points: "asc" }
  });

  return new Response(JSON.stringify({ regular, premium }), {
    headers: { "Content-Type": "application/json" }
  });

};


/* SAVE RULES */

export const action = async ({ request }) => {

  const body = await request.json();

  const { regularRules, premiumRules } = body;

  /* SAVE REGULAR RULES */

  for (const rule of regularRules) {

    await prisma.regularPointRule.upsert({
      where: { points: Number(rule.points) },
      update: { discount: Number(rule.discount) },
      create: {
        points: Number(rule.points),
        discount: Number(rule.discount)
      }
    });

  }

  /* SAVE PREMIUM RULES */

  for (const rule of premiumRules) {

    await prisma.premiumPointRule.upsert({
      where: { points: Number(rule.points) },
      update: { discount: Number(rule.discount) },
      create: {
        points: Number(rule.points),
        discount: Number(rule.discount)
      }
    });

  }

  /* RUN DISCOUNT UPDATE */

  await updateCustomerDiscounts();

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: { "Content-Type": "application/json" }
  });

};