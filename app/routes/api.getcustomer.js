import prisma from "../db.server";

export async function loader() {

  try {

    const customers = await prisma.rewardCustomer.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    const jsonData = JSON.stringify(customers);

    return new Response(jsonData, {
      headers: {
        "Content-Type": "application/json"
      }
    });

  } catch (error) {

    console.error("Customer API Error:", error);

    return new Response(JSON.stringify({
      success: false,
      message: "Failed to fetch customers"
    }), { status: 500 });

  }

}