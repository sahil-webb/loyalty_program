import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Tier } from "@prisma/client";
import { nanoid } from "../lib/nanoid.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerId: string | undefined = payload.customer?.id
    ? `gid://shopify/Customer/${payload.customer.id}`
    : undefined;

  if (!customerId) return new Response();

  const totalPrice: number = parseFloat(payload.total_price ?? "0");
  if (totalPrice <= 0) return new Response();

  const orderId = `gid://shopify/Order/${payload.id}`;

  // Idempotency – skip if we already processed this order
  const existing = await db.rewardTransaction.findFirst({
    where: { shop, orderId },
  });
  if (existing) return new Response();

  let customer = await db.loyaltyCustomer.findUnique({
    where: { shop_shopifyId: { shop, shopifyId: customerId } },
  });

  if (!customer) {
    // Auto-enrol customer on first order
    customer = await db.loyaltyCustomer.create({
      data: {
        shop,
        shopifyId: customerId,
        email: payload.customer?.email ?? null,
        firstName: payload.customer?.first_name ?? null,
        lastName: payload.customer?.last_name ?? null,
        referralCode: nanoid(),
      },
    });
  }

  const isVip =
    customer.tier === Tier.VIP &&
    customer.vipExpiresAt !== null &&
    customer.vipExpiresAt > new Date();

  const ptsPerDollar = isVip ? 2 : 1;
  const earned = Math.floor(totalPrice * ptsPerDollar);

  if (earned === 0) return new Response();

  const newBalance = customer.points + earned;

  await db.$transaction([
    db.loyaltyCustomer.update({
      where: { id: customer.id },
      data: { points: newBalance },
    }),
    db.rewardTransaction.create({
      data: {
        shop,
        shopifyId: customerId,
        type: "EARN",
        points: earned,
        balanceAfter: newBalance,
        description: `Order #${payload.order_number} — ${ptsPerDollar}pt/$1`,
        orderId,
      },
    }),
  ]);

  return new Response();
};
