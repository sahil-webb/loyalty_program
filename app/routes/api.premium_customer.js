import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    const body = await request.json();

    const secret = body.secret;
    const email = body.email;

    /* -----------------------
       VALIDATE SECRET
    ------------------------*/

    if (secret !== "premium_customer") {
      return new Response("Unauthorized", { status: 401 });
    }

    /* -----------------------
       EXTRACT CUSTOMER ID
    ------------------------*/

    let rawCustomerId = body.customer_id;

    if (!rawCustomerId) {
      return new Response("Customer ID missing", { status: 400 });
    }

    const customerId = rawCustomerId.split("/").pop();

    /* -----------------------
       CHECK EXISTING CUSTOMER
    ------------------------*/

    const existingCustomer = await prisma.premiumCustomer.findUnique({
      where: {
        shopifyId: String(customerId)
      }
    });

    /* -----------------------
       CREATE CUSTOMER + 500 COINS
    ------------------------*/

    if (!existingCustomer) {

      await prisma.premiumCustomer.create({
        data: {
          shopifyId: String(customerId),
          email: email,
          coins: 500
        }
      });

    }

    return new Response(
      JSON.stringify({
        success: true
      }),
      { status: 200 }
    );

  } catch (error) {

    console.error("Premium loyalty error:", error);

    return new Response(
      JSON.stringify({
        error: "Server error"
      }),
      { status: 500 }
    );

  }
};