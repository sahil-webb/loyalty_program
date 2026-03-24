import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    const body = await request.json();

    const type = body.type;
    const points = body.points;
    const discount = body.discount;

    if (type === "regular") {

      await prisma.regularPointRule.create({
        data: {
          points: points,
          discount: discount
        }
      });

    }

    if (type === "premium") {

      await prisma.premiumPointRule.create({
        data: {
          points: points,
          discount: discount
        }
      });

    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200
    });

  } catch (error) {

    console.error("Point rule error:", error);

    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500
    });

  }
};