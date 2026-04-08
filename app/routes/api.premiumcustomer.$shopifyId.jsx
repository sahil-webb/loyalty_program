import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request, params }) {

  const { admin, session } = await authenticate.admin(request);

  const shop = session.shop;
  const shopifyId = params.shopifyId;

  // Get loyalty customer
  const rewardCustomer = await prisma.rewardCustomer.findUnique({
    where: {
      shop_shopifyId: {
        shop,
        shopifyId
      }
    }
  });

  // Get transaction history
  const transactions = await prisma.rewardTransaction.findMany({
    where: {
      shop,
      shopifyId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  // Fetch Shopify customer details
  const response = await admin.graphql(`
  {
    customer(id: "gid://shopify/Customer/${shopifyId}") {
      firstName
      lastName
      email
      phone
      defaultAddress {
        address1
        city
        country
      }
    }
  }
  `);

  const data = await response.json();

  const shopifyCustomer = data.data.customer;

  const address = shopifyCustomer?.defaultAddress
    ? `${shopifyCustomer.defaultAddress.address1}, ${shopifyCustomer.defaultAddress.city}, ${shopifyCustomer.defaultAddress.country}`
    : null;

  return Response.json({
    customer: {
      shopifyId,
      firstName: shopifyCustomer?.firstName || rewardCustomer?.firstName,
      lastName: shopifyCustomer?.lastName || rewardCustomer?.lastName,
      email: shopifyCustomer?.email || rewardCustomer?.email,
      phone: shopifyCustomer?.phone || null,
      address,
      points: rewardCustomer?.points || 0,
      tier: rewardCustomer?.tier || "insider",
      referralCode: rewardCustomer?.referralCode,
      discountCode: rewardCustomer?.discountCode,
      createdAt: rewardCustomer?.createdAt
    },
    transactions
  });

}