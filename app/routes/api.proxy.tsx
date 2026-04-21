/**
 * Storefront proxy — called by the Residence Rewards widget on the customer account page.
 * Shopify routes requests from /apps/rewards/* to this endpoint.
 *
 * GET  /api/proxy?action=status&customerId=<gid>   — return customer points + tier
 * POST /api/proxy  { action: "redeem", customerId, rewardId }  — redeem points for discount
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ─── GET ───────────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { storefront } = await authenticate.public.appProxy(request);
  void storefront; // authenticated but unused for reads

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const shop = url.searchParams.get("shop") ?? "";

  if (!customerId) return json({ error: "missing customerId" }, 400);

  const customer = await db.loyaltyCustomer.findUnique({
    where: { shop_shopifyId: { shop, shopifyId: customerId } },
    select: {
      points: true,
      tier: true,
      vipExpiresAt: true,
      referralCode: true,
    },
  });

  const rewards = await db.reward.findMany({
    where: { isActive: true },
    orderBy: { pointCost: "asc" },
  });

  return json({ customer, rewards });
};

// ─── POST ──────────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const body = (await request.json()) as {
    action: string;
    customerId: string;
    shop: string;
    rewardId?: number;
  };

  if (body.action === "redeem") {
    return handleRedeem(body);
  }

  return json({ error: "unknown action" }, 400);
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function handleRedeem({
  customerId,
  shop,
  rewardId,
}: {
  customerId: string;
  shop: string;
  rewardId?: number;
}) {
  if (!rewardId) return json({ error: "missing rewardId" }, 400);

  const [customer, reward] = await Promise.all([
    db.loyaltyCustomer.findUnique({
      where: { shop_shopifyId: { shop, shopifyId: customerId } },
    }),
    db.reward.findUnique({ where: { id: rewardId } }),
  ]);

  if (!customer) return json({ error: "customer not found" }, 404);
  if (!reward || !reward.isActive) return json({ error: "reward not found" }, 404);
  if (customer.points < reward.pointCost)
    return json({ error: "insufficient points" }, 422);

  const newBalance = customer.points - reward.pointCost;

  await db.$transaction([
    db.loyaltyCustomer.update({
      where: { id: customer.id },
      data: { points: newBalance },
    }),
    db.rewardTransaction.create({
      data: {
        shop,
        shopifyId: customerId,
        type: "REDEEM",
        points: -reward.pointCost,
        balanceAfter: newBalance,
        description: `Redeemed ${reward.pointCost}pts for $${(reward.discountValue / 100).toFixed(0)} discount`,
      },
    }),
  ]);

  return json({ success: true, newBalance });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
