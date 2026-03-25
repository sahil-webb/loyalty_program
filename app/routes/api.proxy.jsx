import prisma from "../db.server";

export async function action({ request }) {
  try {

    const body = await request.json();

    const { first_name, last_name, email, birthday, password } = body;

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return new Response(JSON.stringify({
        success:false,
        message:"Shop missing"
      }));
    }

    /* ----------------------------------------------
       GET SHOP SESSION
    ---------------------------------------------- */

    const session = await prisma.session.findFirst({
      where: { shop }
    });

    if (!session) {
      return new Response(JSON.stringify({
        success:false,
        message:"Session not found"
      }));
    }

    const accessToken = session.accessToken;

    /* ----------------------------------------------
       ADMIN GRAPHQL CLIENT
    ---------------------------------------------- */

    const admin = {
      graphql: async (query, variables = {}) => {
        return fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables }),
        });
      }
    };

    /* ----------------------------------------------
       CREATE SHOPIFY CUSTOMER
    ---------------------------------------------- */

    const customerRes = await fetch(
      `https://${shop}/admin/api/2024-01/customers.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
            first_name,
            last_name,
            email,
            password,
            password_confirmation: password,
            verified_email: true,
            tags: "rsloyalty",
          },
        }),
      }
    );

    const customerData = await customerRes.json();

    if (!customerData.customer) {
      return new Response(JSON.stringify({
        success:false,
        message:"Customer creation failed"
      }));
    }

    const shopifyCustomerId = customerData.customer.admin_graphql_api_id;

    /* ----------------------------------------------
       STORE CUSTOMER IN PRISMA
    ---------------------------------------------- */

    const customer = await prisma.rewardCustomer.create({
      data: {
        shop,
        shopifyId: shopifyCustomerId,
        firstName: first_name,
        lastName: last_name,
        email,
        birthday,
        points: 500
      }
    });

    const coins = customer.points;

    /* ----------------------------------------------
       CALCULATE DISCOUNT FROM RULE TABLE
    ---------------------------------------------- */

    const rule = await prisma.regularPointRule.findFirst({
      where: {
        points: {
          lte: coins
        }
      },
      orderBy: {
        points: "desc"
      }
    });

    let discountAmount = 0;

    if (rule) {
      discountAmount = rule.discount;
    }

    console.log("🎯 Rule matched:", rule);
    console.log("💰 Discount amount:", discountAmount);

    /* ----------------------------------------------
       DISCOUNT CODE
    ---------------------------------------------- */

    const discountCode = `PTS-${email.split("@")[0].toUpperCase()}`;

    console.log("🎟️ Discount Code:", discountCode);

    /* ----------------------------------------------
       SEARCH EXISTING DISCOUNT
    ---------------------------------------------- */

    const discountSearchRes = await admin.graphql(
      `
      query ($query: String!) {
        codeDiscountNodes(first: 10, query: $query) {
          nodes {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                codes(first: 10) {
                  nodes {
                    code
                  }
                }
              }
            }
          }
        }
      }
      `,
      { query: `code:${discountCode}` }
    );

    const discountSearchData = await discountSearchRes.json();

    console.log("🔍 Discount search response:", discountSearchData);

    let discountNode = null;

    const discountNodes =
      discountSearchData?.data?.codeDiscountNodes?.nodes || [];

    for (const node of discountNodes) {

      const codes = node.codeDiscount?.codes?.nodes || [];

      if (codes.some((c) => c.code === discountCode)) {
        discountNode = node;
        break;
      }

    }

    /* ----------------------------------------------
       CREATE DISCOUNT
    ---------------------------------------------- */

    if (!discountNode) {

      console.log("➕ Creating discount");

      const createDiscountRes = await admin.graphql(
        `
        mutation ($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            codeDiscountNode { id }
            userErrors { field message }
          }
        }
        `,
        {
          input: {
            title: discountCode,
            code: discountCode,
            startsAt: new Date().toISOString(),

            customerSelection: {
              customers: { add: [shopifyCustomerId] }
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

            usageLimit: 1000,
            appliesOncePerCustomer: false,

            combinesWith: {
              shippingDiscounts: true,
              orderDiscounts: false,
              productDiscounts: false
            }
          }
        }
      );

      const createDiscountData = await createDiscountRes.json();

      console.log("🎟️ Discount create response:", createDiscountData);

    } else {

      console.log("✏️ Updating discount");

      const updateRes = await admin.graphql(
        `
        mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
            userErrors { field message }
          }
        }
        `,
        {
          id: discountNode.id,
          input: {
            customerGets: {
              items: { all: true },
              value: {
                discountAmount: {
                  amount: String(discountAmount),
                  appliesOnEachItem: false
                }
              }
            }
          }
        }
      );

      const updateData = await updateRes.json();

      console.log("✏️ Discount update response:", updateData);

    }

    return new Response(JSON.stringify({
      success:true,
      points:coins,
      discount:discountCode,
      discountAmount
    }),{
      headers:{
        "Content-Type":"application/json"
      }
    });

  } catch(error) {

    console.error("Proxy Error:", error);

    return new Response(JSON.stringify({
      success:false,
      message:"Server error"
    }),{
      status:500
    });

  }
}