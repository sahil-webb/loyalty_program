import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerId: string | undefined = payload.customer?.id
    ? `gid://shopify/Customer/${payload.customer.id}`
    : undefined;

  if (!customerId) return new Response();

  const orderId = `gid://shopify/Order/${payload.id}`;

  // Find the EARN transaction for this order
  const earnTx = await db.rewardTransaction.findFirst({
    where: { shop, shopifyId: customerId, orderId, type: "EARN" },
  });

  if (!earnTx) return new Response();

  const customer = await db.loyaltyCustomer.findUnique({
    where: { shop_shopifyId: { shop, shopifyId: customerId } },
  });

  if (!customer) return new Response();

  const reversal = earnTx.points;
  const newBalance = Math.max(0, customer.points - reversal);

  await db.$transaction([
    db.loyaltyCustomer.update({
      where: { id: customer.id },
      data: { points: newBalance },
    }),
    db.rewardTransaction.create({
      data: {
        shop,
        shopifyId: customerId,
        type: "ADJUSTMENT",
        points: -reversal,
        balanceAfter: newBalance,
        description: `Order #${payload.order_number} cancelled — points reversed`,
        orderId,
      },
    }),
  ]);

  return new Response();
};
