import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request, params }) {

  const { admin, session } = await authenticate.admin(request);

  const shop = session.shop;
  const shopifyId = params.shopifyId;

  /* -------------------------
     Loyalty Customer (Prisma)
  --------------------------*/

  const premiumCustomer = await prisma.premiumCustomer.findUnique({
    where: {
      shop_shopifyId: {
        shop,
        shopifyId
      }
    }
  });

  /* -------------------------
     Transactions
  --------------------------*/

  const transactions = await prisma.rewardTransaction.findMany({
    where: {
      shop,
      shopifyId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  /* -------------------------
     Shopify Customer
  --------------------------*/

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
          province
          country
        }
      }
    }
  `);

  const data = await response.json();
  const shopifyCustomer = data?.data?.customer;

  const address = shopifyCustomer?.defaultAddress
    ? `${shopifyCustomer.defaultAddress.address1}, ${shopifyCustomer.defaultAddress.city}, ${shopifyCustomer.defaultAddress.province}, ${shopifyCustomer.defaultAddress.country}`
    : null;

  return Response.json({
    customer: {
      shopifyId,
      firstName: shopifyCustomer?.firstName || "",
      lastName: shopifyCustomer?.lastName || "",
      email: shopifyCustomer?.email || premiumCustomer?.email || "",
      phone: shopifyCustomer?.phone || "",
      address,

      /* Loyalty data */
      coins: premiumCustomer?.coins || 0,
      tier: premiumCustomer?.tier || "insider",
      referralCode: premiumCustomer?.referralCode,
      signInWithReferral: premiumCustomer?.signInWithReferral,
      signInReferralCode: premiumCustomer?.signInReferralCode,
      discountCode: premiumCustomer?.discountCode,
      lastVisitReward: premiumCustomer?.lastVisitReward,
      createdAt: premiumCustomer?.createdAt
    },

    transactions
  });
}