import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {

    const body = await request.json();

    const customerId = body.customer_id;
    const email = body.email;

    if (!customerId) {
      return new Response("Customer not found", { status: 400 });
    }

    /* -------------------------------
       ADD CUSTOMER TAG IN SHOPIFY
    --------------------------------*/

    const mutation = `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            tags
          }
        }
      }
    `;

    await admin.graphql(mutation, {
      variables: {
        input: {
          id: `gid://shopify/Customer/${customerId}`,
          tags: ["premiumloyalty"]
        }
      }
    });


    /* -------------------------------
       SAVE CUSTOMER IN PRISMA
    --------------------------------*/

    const existingCustomer = await prisma.premiumCustomer.findUnique({
      where: {
        shopifyId: String(customerId)
      }
    });

    if (!existingCustomer) {

      await prisma.premiumCustomer.create({
        data: {
          shopifyId: String(customerId),
          email: email
        }
      });

    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200
    });

  } catch (error) {

    console.error("Premium loyalty error:", error);

    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500
    });
  }
};