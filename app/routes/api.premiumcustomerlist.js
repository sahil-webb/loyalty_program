import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const loader = async () => {

  try {

    const customers = await prisma.premiumCustomer.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return new Response(JSON.stringify(customers), {
      headers: {
        "Content-Type": "application/json"
      }
    });

  } catch (error) {

    console.error("Error fetching premium customers:", error);

    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500
    });

  }

};