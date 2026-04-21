// GDPR: erase customer data on request
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const shopifyId = `gid://shopify/Customer/${payload.customer?.id}`;

  await db.$transaction([
    db.rewardTransaction.deleteMany({ where: { shop, shopifyId } }),
    db.loyaltyCustomer.deleteMany({ where: { shop, shopifyId } }),
  ]);

  return new Response();
};
