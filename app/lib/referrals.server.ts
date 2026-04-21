/**
 * Referral completion — called from webhooks.orders.paid when a customer's
 * first order is processed. Awards referral points to the referrer.
 *
 * Residence Insider referrer: +100pts
 * Residence VIP referrer:     +200pts
 */

import db from "../db.server";
import { Tier } from "@prisma/client";

export async function completeReferralIfFirstOrder(
  shop: string,
  shopifyId: string,
  email: string | null,
  priorEarnCount: number, // number of EARN txns BEFORE this order
): Promise<void> {
  // Only fires on first order
  if (priorEarnCount !== 0) return;

  const referee = await db.loyaltyCustomer.findUnique({
    where: { shop_shopifyId: { shop, shopifyId } },
    select: { referredByCode: true },
  });

  if (!referee?.referredByCode) return;

  // Find the referrer
  const referrer = await db.loyaltyCustomer.findUnique({
    where: { referralCode: referee.referredByCode },
  });

  if (!referrer) return;

  // Find pending referral record (matched by shop + refereeEmail)
  const referral = email
    ? await db.referral.findUnique({
        where: { shop_refereeEmail: { shop, refereeEmail: email } },
      })
    : null;

  if (referral && referral.status !== "PENDING") return;

  const earnedPoints = referrer.tier === Tier.VIP ? 200 : 100;
  const newBalance = referrer.points + earnedPoints;

  await db.$transaction([
    // Award points to referrer
    db.loyaltyCustomer.update({
      where: { id: referrer.id },
      data: { points: newBalance },
    }),
    db.rewardTransaction.create({
      data: {
        shop,
        shopifyId: referrer.shopifyId,
        type: "REFERRAL",
        points: earnedPoints,
        balanceAfter: newBalance,
        description: `Referral completed — new member ${email ?? shopifyId}`,
      },
    }),
    // Mark referral complete if record exists
    ...(referral
      ? [
          db.referral.update({
            where: { id: referral.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              refereeShopifyId: shopifyId,
            },
          }),
        ]
      : []),
  ]);
}
