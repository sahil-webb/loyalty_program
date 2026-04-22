/**
 * Shopify discount code generation via Admin GraphQL.
 * Uses the shop's stored offline session via unauthenticated.admin().
 */

import { unauthenticated } from "../shopify.server";

const CREATE_DISCOUNT = `#graphql
  mutation CreateBasicDiscount($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode {
        codeDiscount {
          ... on DiscountCodeBasic {
            codes(first: 1) {
              nodes {
                code
              }
            }
          }
        }
      }
      userErrors {
        field
        code
        message
      }
    }
  }
`;

/**
 * Create a single-use dollar-off discount code in Shopify.
 *
 * @param shop  - myshopify domain (e.g. "residence-supply.myshopify.com")
 * @param amountInCents - discount value in USD cents (e.g. 500 = $5)
 * @param code  - the discount code string to create (must be unique in Shopify)
 * @returns the discount code string
 */
export async function createDiscountCode(
  shop: string,
  amountInCents: number,
  code: string,
): Promise<string> {
  const { admin } = await unauthenticated.admin(shop);
  const amount = (amountInCents / 100).toFixed(2);

  const response = await admin.graphql(CREATE_DISCOUNT, {
    variables: {
      input: {
        title: `Residence Rewards — $${Math.round(amountInCents / 100)} off`,
        code,
        startsAt: new Date().toISOString(),
        usageLimit: 1,
        appliesOncePerCustomer: true,
        customerGets: {
          value: {
            discountAmount: {
              amount,
              appliesOnEachItem: false,
            },
          },
          items: { all: true },
        },
        customerSelection: { all: true },
      },
    },
  });

  const json = await response.json();

  // Top-level request errors (auth failure, malformed query, etc.)
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
  }

  // Mutation-level user errors (invalid input, duplicate code, etc.)
  const userErrors = json.data?.discountCodeBasicCreate?.userErrors as
    | Array<{ message: string }>
    | undefined;

  if (userErrors?.length) {
    throw new Error(`Shopify discount error: ${userErrors[0].message}`);
  }

  return code;
}
