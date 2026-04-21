// GDPR: shop-level data erasure after app uninstall
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await db.$transaction([
    db.rewardTransaction.deleteMany({ where: { shop } }),
    db.referral.deleteMany({ where: { shop } }),
    db.loyaltyCustomer.deleteMany({ where: { shop } }),
    db.auditLog.deleteMany({ where: { shop } }),
  ]);

  return new Response();
};
