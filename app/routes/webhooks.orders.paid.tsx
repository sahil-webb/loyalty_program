import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Tier } from "@prisma/client";
import { nanoid } from "../lib/nanoid.server";
import { completeReferralIfFirstOrder } from "../lib/referrals.server";

// Set VIP_PRODUCT_ID env var to the numeric Shopify product ID for VIP membership
const VIP_PRODUCT_ID = process.env.VIP_PRODUCT_ID;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerId: string | undefined = payload.customer?.id
    ? `gid://shopify/Customer/${payload.customer.id}`
    : undefined;

  if (!customerId) return new Response();

  const orderId = `gid://shopify/Order/${payload.id}`;

  // Idempotency — skip if already processed
  const existing = await db.rewardTransaction.findFirst({
    where: { shop, orderId },
  });
  if (existing) return new Response();

  // ── VIP membership purchase detection ───────────────────────────────────────
  if (VIP_PRODUCT_ID) {
    const lineItems = (payload.line_items as Array<{ product_id: number }>) ?? [];
    const hasVipProduct = lineItems.some(
      (item) => String(item.product_id) === VIP_PRODUCT_ID,
    );

    if (hasVipProduct) {
      await activateVip(shop, customerId, payload);
      return new Response();
    }
  }

  // ── Normal order — earn points ───────────────────────────────────────────────
  const totalPrice: number = parseFloat(payload.total_price ?? "0");
  if (totalPrice <= 0) return new Response();

  let customer = await db.loyaltyCustomer.findUnique({
    where: { shop_shopifyId: { shop, shopifyId: customerId } },
  });

  if (!customer) {
    // Auto-enrol on first order
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

  const activeVip =
    customer.tier === Tier.VIP &&
    customer.vipExpiresAt !== null &&
    customer.vipExpiresAt > new Date();

  const ptsPerDollar = activeVip ? 2 : 1;
  const earned = Math.floor(totalPrice * ptsPerDollar);

  if (earned === 0) return new Response();

  // Count prior EARNs before committing the new one (for referral detection)
  const priorEarns = await db.rewardTransaction.count({
    where: { shop, shopifyId: customerId, type: "EARN" },
  });

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

  // Fire referral completion (no-op if not a referral or not first order)
  await completeReferralIfFirstOrder(
    shop,
    customerId,
    customer.email,
    priorEarns,
  );

  return new Response();
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function activateVip(
  shop: string,
  shopifyId: string,
  payload: Record<string, unknown>,
) {
  let customer = await db.loyaltyCustomer.findUnique({
    where: { shop_shopifyId: { shop, shopifyId } },
  });

  if (!customer) {
    customer = await db.loyaltyCustomer.create({
      data: {
        shop,
        shopifyId,
        email: (payload.customer as Record<string, string>)?.email ?? null,
        firstName: (payload.customer as Record<string, string>)?.first_name ?? null,
        lastName: (payload.customer as Record<string, string>)?.last_name ?? null,
        referralCode: nanoid(),
      },
    });
  }

  const isRenewal = customer.tier === Tier.VIP;
  const now = new Date();
  const vipExpiresAt = new Date(now);
  vipExpiresAt.setFullYear(vipExpiresAt.getFullYear() + 1);

  await db.$transaction([
    db.loyaltyCustomer.update({
      where: { id: customer.id },
      data: { tier: Tier.VIP, vipExpiresAt },
    }),
    db.rewardTransaction.create({
      data: {
        shop,
        shopifyId,
        type: isRenewal ? "VIP_RENEW" : "VIP_JOIN",
        points: 0,
        balanceAfter: customer.points,
        description: isRenewal
          ? `VIP membership renewed until ${vipExpiresAt.toLocaleDateString()}`
          : `VIP membership activated until ${vipExpiresAt.toLocaleDateString()}`,
        orderId: `gid://shopify/Order/${payload.id}`,
      },
    }),
  ]);
}
