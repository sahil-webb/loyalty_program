/**
 * Storefront proxy — Shopify routes /apps/rewards/* requests here.
 *
 * GET  ?action=status&customerId=<gid>&shop=<domain>
 *       → { customer, rewards }
 *
 * POST { action: "signup",  customerId, shop, referralCode? }
 *       → { success, customer }
 *
 * POST { action: "redeem",  customerId, shop, rewardId }
 *       → { success, discountCode, newBalance }
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { nanoid } from "../lib/nanoid.server";
import { createDiscountCode } from "../lib/discounts.server";

// ─── GET ───────────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") ?? "";
  const customerId = url.searchParams.get("customerId");

  if (!customerId || !shop) return json({ error: "missing params" }, 400);

  const [customer, rewards] = await Promise.all([
    db.loyaltyCustomer.findUnique({
      where: { shop_shopifyId: { shop, shopifyId: customerId } },
      select: {
        points: true,
        tier: true,
        vipExpiresAt: true,
        referralCode: true,
      },
    }),
    db.reward.findMany({
      where: { isActive: true },
      orderBy: { pointCost: "asc" },
      select: { id: true, pointCost: true, discountValue: true, tier: true },
    }),
  ]);

  // Honour VIP expiry
  const effectiveTier =
    customer?.tier === "VIP" &&
    customer.vipExpiresAt &&
    customer.vipExpiresAt > new Date()
      ? "VIP"
      : "RESIDENT";

  return json({
    customer: customer
      ? { ...customer, effectiveTier }
      : null,
    rewards,
  });
};

// ─── POST ──────────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const body = (await request.json()) as {
    action: string;
    customerId: string;
    shop: string;
    rewardId?: number;
    referralCode?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };

  if (body.action === "signup") return handleSignup(body);
  if (body.action === "redeem") return handleRedeem(body);

  return json({ error: "unknown action" }, 400);
};

// ─── Sign-up ───────────────────────────────────────────────────────────────────

async function handleSignup({
  customerId,
  shop,
  referralCode,
  email,
  firstName,
  lastName,
}: {
  customerId: string;
  shop: string;
  referralCode?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  if (!customerId || !shop) return json({ error: "missing params" }, 400);

  const existing = await db.loyaltyCustomer.findUnique({
    where: { shop_shopifyId: { shop, shopifyId: customerId } },
  });

  if (existing) return json({ success: true, customer: existing, alreadyMember: true });

  // Validate referral code if provided
  let referredByCode: string | null = null;
  if (referralCode) {
    const referrer = await db.loyaltyCustomer.findUnique({
      where: { referralCode },
      select: { id: true, shop: true },
    });
    // Only accept referral codes from the same shop
    if (referrer && referrer.shop === shop) {
      referredByCode = referralCode;
    }
  }

  const customer = await db.loyaltyCustomer.create({
    data: {
      shop,
      shopifyId: customerId,
      email: email ?? null,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      referralCode: nanoid(),
      referredByCode,
    },
  });

  // Create a pending referral record if referred
  if (referredByCode && email) {
    await db.referral.upsert({
      where: { shop_refereeEmail: { shop, refereeEmail: email } },
      create: {
        shop,
        referrerCode: referredByCode,
        refereeEmail: email,
        refereeShopifyId: customerId,
        status: "PENDING",
      },
      update: {}, // don't overwrite if already exists
    });
  }

  return json({ success: true, customer, alreadyMember: false });
}

// ─── Redeem ────────────────────────────────────────────────────────────────────

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

  const discountCode = `RES-${nanoid(8).toUpperCase()}`;
  const newBalance = customer.points - reward.pointCost;

  // Deduct points + create transaction
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
        description: `Redeemed ${reward.pointCost}pts → ${discountCode}`,
      },
    }),
  ]);

  // Generate Shopify discount code (best-effort — points already deducted)
  try {
    await createDiscountCode(shop, reward.discountValue, discountCode);
  } catch (err) {
    console.error("Failed to create Shopify discount code:", err);
    // Code is still returned — merchant can create manually if needed
  }

  return json({ success: true, discountCode, newBalance });
}

// ─── Util ──────────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
