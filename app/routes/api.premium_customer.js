import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    /* -------------------------------
       GET BODY FROM SHOPIFY FLOW
    --------------------------------*/

    const body = await request.json();

    const customerId = body.customer_id;
    const email = body.email;
    const secret = body.secret;

    /* -------------------------------
       VALIDATE SECRET
    --------------------------------*/

    if (secret !== "premium_customer") {
      return new Response("Unauthorized request", { status: 401 });
    }

    if (!customerId) {
      return new Response("Customer ID missing", { status: 400 });
    }

    /* -------------------------------
       CHECK IF CUSTOMER EXISTS
    --------------------------------*/

    const existingCustomer = await prisma.premiumCustomer.findUnique({
      where: {
        shopifyId: String(customerId)
      }
    });

    /* -------------------------------
       CREATE CUSTOMER WITH 500 COINS
    --------------------------------*/

    if (!existingCustomer) {

      await prisma.premiumCustomer.create({
        data: {
          shopifyId: String(customerId),
          email: email,
          coins: 500
        }
      });

    }

    /* -------------------------------
       SUCCESS RESPONSE
    --------------------------------*/

    return new Response(
      JSON.stringify({
        success: true,
        message: "Customer added and 500 coins assigned"
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