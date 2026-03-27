import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

/* SHOPIFY GRAPHQL */

async function shopifyGraphQL(query, variables = {}) {

  const res = await fetch(
    `https://${SHOP}/admin/api/2024-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN
      },
      body: JSON.stringify({ query, variables })
    }
  );

  return res.json();
}

/* CALCULATE DISCOUNT */

function calculateDiscount(value, rules) {

  let discount = 0;

  for (const rule of rules) {
    if (value >= rule.points) {
      discount = rule.discount;
    }
  }

  return discount;
}

/* UPDATE ALL CUSTOMER DISCOUNTS */

export async function updateCustomerDiscounts() {

  console.log("🚀 Updating customer discounts...");

  const regularRules = await prisma.regularPointRule.findMany({
    orderBy: { points: "asc" }
  });

  const premiumRules = await prisma.premiumPointRule.findMany({
    orderBy: { points: "asc" }
  });

  /* =========================
     REGULAR CUSTOMERS
  ========================= */

  const regularCustomers = await prisma.rewardCustomer.findMany();

  for (const customer of regularCustomers) {

    if (!customer.discountCode) continue;

    const discountAmount = calculateDiscount(customer.points, regularRules);

    const code = customer.discountCode;

    const shopifyCustomerId = `gid://shopify/Customer/${customer.shopifyId}`;

    console.log("Updating regular:", code);

    /* SEARCH DISCOUNT */

    const search = await shopifyGraphQL(
      `query($query:String!){
        codeDiscountNodes(first:1, query:$query){
          edges{
            node{
              id
            }
          }
        }
      }`,
      { query: `code:${code}` }
    );

    const discountNode =
      search?.data?.codeDiscountNodes?.edges?.[0]?.node;

    /* DELETE DISCOUNT */

    if (discountNode) {

      await shopifyGraphQL(
        `mutation($id:ID!){
          discountDelete(id:$id){
            deletedDiscountId
          }
        }`,
        { id: discountNode.id }
      );

    }

    /* CREATE NEW DISCOUNT */

    await shopifyGraphQL(
      `mutation ($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          userErrors { message }
        }
      }`,
      {
        input: {
          title: code,
          code: code,
          startsAt: new Date().toISOString(),

          customerSelection: {
            customers: {
              add: [shopifyCustomerId]
            }
          },

          customerGets: {
            items: { all: true },
            value: {
              discountAmount: {
                amount: String(discountAmount),
                appliesOnEachItem: false
              }
            }
          },

          usageLimit: 1
        }
      }
    );

  }

  /* =========================
     PREMIUM CUSTOMERS
  ========================= */

  const premiumCustomers = await prisma.premiumCustomer.findMany();

  for (const customer of premiumCustomers) {

    if (!customer.discountCode) continue;

    const discountAmount = calculateDiscount(customer.coins, premiumRules);

    const code = customer.discountCode;

    const shopifyCustomerId = `gid://shopify/Customer/${customer.shopifyId}`;

    console.log("Updating premium:", code);

    const search = await shopifyGraphQL(
      `query($query:String!){
        codeDiscountNodes(first:1, query:$query){
          edges{
            node{
              id
            }
          }
        }
      }`,
      { query: `code:${code}` }
    );

    const discountNode =
      search?.data?.codeDiscountNodes?.edges?.[0]?.node;

    if (discountNode) {

      await shopifyGraphQL(
        `mutation($id:ID!){
          discountDelete(id:$id){
            deletedDiscountId
          }
        }`,
        { id: discountNode.id }
      );

    }

    await shopifyGraphQL(
      `mutation ($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          userErrors { message }
        }
      }`,
      {
        input: {
          title: code,
          code: code,
          startsAt: new Date().toISOString(),

          customerSelection: {
            customers: {
              add: [shopifyCustomerId]
            }
          },

          customerGets: {
            items: { all: true },
            value: {
              discountAmount: {
                amount: String(discountAmount),
                appliesOnEachItem: false
              }
            }
          },

          usageLimit: 1000
        }
      }
    );

  }

  console.log("✅ Customer discounts updated");

}