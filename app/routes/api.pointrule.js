import { PrismaClient } from "@prisma/client";

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


/* SAVE / UPDATE RULE */

export const action = async ({ request }) => {

  const body = await request.json();

  const { type, points, discount } = body;

  if (type === "regular") {

    await prisma.regularPointRule.upsert({
      where: { points: Number(points) },
      update: { discount: Number(discount) },
      create: {
        points: Number(points),
        discount: Number(discount)
      }
    });

  }

  if (type === "premium") {

    await prisma.premiumPointRule.upsert({
      where: { points: Number(points) },
      update: { discount: Number(discount) },
      create: {
        points: Number(points),
        discount: Number(discount)
      }
    });

  }

  return new Response(JSON.stringify({ success: true }));

};