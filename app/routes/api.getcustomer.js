import prisma from "../db.server";

export async function loader({ request }) {

  try {

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    const customers = await prisma.rewardCustomer.findMany({
      where: shop ? { shop } : undefined,
      orderBy: {
        createdAt: "desc"
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        customers
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {

    console.error("Customer API Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to fetch customers"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  }

}