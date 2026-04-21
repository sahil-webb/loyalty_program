/**
 * Prisma seed — Residence Rewards point rules + redemption tiers
 * Run via: npx prisma db seed
 *
 * Residence Insider (RESIDENT — Free):
 *   Earn:   1pt/$1 spend | 25pts review | 10pts social share | 100pts referral
 *   Redeem: 100pts→$5 | 250pts→$15 | 500pts→$50
 *
 * Residence VIP ($150/yr):
 *   Earn:   2pts/$1 spend | 50pts review | 25pts social share | 200pts referral
 *   Redeem: 500pts→$50 (VIP-exclusive)
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Idempotent — skip if rules already exist
  const existing = await db.pointRule.count();
  if (existing > 0) {
    console.log("Seed already applied — skipping.");
    return;
  }

  // ─── Point Rules ─────────────────────────────────────────────────────────────

  await db.pointRule.createMany({
    data: [
      // RESIDENT
      { tier: "RESIDENT", action: "ORDER",    points: 1   }, // pts per $1
      { tier: "RESIDENT", action: "REVIEW",   points: 25  },
      { tier: "RESIDENT", action: "SOCIAL",   points: 10  },
      { tier: "RESIDENT", action: "REFERRAL", points: 100 },
      { tier: "RESIDENT", action: "BIRTHDAY", points: 50  },
      // VIP
      { tier: "VIP", action: "ORDER",    points: 2   }, // pts per $1
      { tier: "VIP", action: "REVIEW",   points: 50  },
      { tier: "VIP", action: "SOCIAL",   points: 25  },
      { tier: "VIP", action: "REFERRAL", points: 200 },
      { tier: "VIP", action: "BIRTHDAY", points: 100 },
    ],
  });

  // ─── Redemption Rewards ───────────────────────────────────────────────────────

  await db.reward.createMany({
    data: [
      // Available to all tiers
      { tier: null, pointCost: 100, discountValue: 500,  isActive: true }, // $5
      { tier: null, pointCost: 250, discountValue: 1500, isActive: true }, // $15
      { tier: null, pointCost: 500, discountValue: 5000, isActive: true }, // $50
    ],
  });

  console.log("Seed complete:");
  console.log("  10 point rules (RESIDENT + VIP)");
  console.log("  3 reward tiers (100→$5, 250→$15, 500→$50)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
