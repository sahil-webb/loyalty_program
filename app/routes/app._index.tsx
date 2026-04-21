import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  DataTable,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { Tier } from "@prisma/client";

// ─── Loader ────────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [totalCustomers, vipCount, rules, rewards] = await Promise.all([
    db.loyaltyCustomer.count({ where: { shop } }),
    db.loyaltyCustomer.count({ where: { shop, tier: Tier.VIP } }),
    db.pointRule.findMany({ where: { isActive: true }, orderBy: [{ tier: "asc" }, { action: "asc" }] }),
    db.reward.findMany({ where: { isActive: true }, orderBy: { pointCost: "asc" } }),
  ]);

  return { shop, totalCustomers, vipCount, rules, rewards, customer: null as CustomerResult | null };
};

type CustomerResult = {
  id: number;
  shopifyId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: Tier;
  points: number;
  vipExpiresAt: Date | null;
  referralCode: string;
  transactions: Array<{
    id: number;
    type: string;
    points: number;
    balanceAfter: number;
    description: string | null;
    createdAt: Date;
  }>;
};

// ─── Action ────────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "search") {
    const query = (form.get("query") as string)?.trim();
    if (!query) return { error: "Enter an email or Shopify customer ID." };

    const customer = await db.loyaltyCustomer.findFirst({
      where: {
        shop,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { shopifyId: { contains: query } },
        ],
      },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    return { customer: customer ?? null, error: customer ? null : "No customer found." };
  }

  if (intent === "adjust") {
    const customerId = parseInt(form.get("customerId") as string);
    const delta = parseInt(form.get("delta") as string);
    const reason = (form.get("reason") as string)?.trim() || "Manual adjustment";

    if (isNaN(customerId) || isNaN(delta) || delta === 0) {
      return { error: "Invalid adjustment." };
    }

    const customer = await db.loyaltyCustomer.findUnique({ where: { id: customerId } });
    if (!customer || customer.shop !== shop) return { error: "Customer not found." };

    const newBalance = Math.max(0, customer.points + delta);
    await db.$transaction([
      db.loyaltyCustomer.update({ where: { id: customerId }, data: { points: newBalance } }),
      db.rewardTransaction.create({
        data: {
          shop,
          shopifyId: customer.shopifyId,
          type: "ADJUSTMENT",
          points: delta,
          balanceAfter: newBalance,
          description: reason,
        },
      }),
      db.auditLog.create({
        data: {
          shop,
          action: "POINT_ADJUSTMENT",
          entityId: String(customerId),
          before: { points: customer.points },
          after: { points: newBalance },
        },
      }),
    ]);

    // Re-fetch with updated data
    const updated = await db.loyaltyCustomer.findUnique({
      where: { id: customerId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    return { customer: updated, error: null };
  }

  return { error: "Unknown action." };
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { totalCustomers, vipCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  const [searchQuery, setSearchQuery] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const customer = actionData?.customer ?? null;
  const error = actionData?.error ?? null;

  const txRows =
    customer?.transactions.map((tx) => [
      new Date(tx.createdAt).toLocaleDateString(),
      tx.type,
      tx.points > 0 ? `+${tx.points}` : String(tx.points),
      String(tx.balanceAfter),
      tx.description ?? "—",
    ]) ?? [];

  return (
    <Page title="Residence Rewards">
      <Layout>
        {/* Stats */}
        <Layout.Section>
          <InlineStack gap="400">
            <Card>
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">Total Members</Text>
                <Text variant="heading2xl" as="p">{totalCustomers}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">VIP Members</Text>
                <Text variant="heading2xl" as="p">{vipCount}</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Customer Search */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Customer Lookup</Text>
              <Form method="post">
                <input type="hidden" name="intent" value="search" />
                <InlineStack gap="300" blockAlign="end">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Email or Shopify customer ID"
                      name="query"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      autoComplete="off"
                    />
                  </div>
                  <Button submit loading={busy} variant="primary">Search</Button>
                </InlineStack>
              </Form>

              {error && <Banner tone="critical">{error}</Banner>}

              {customer && (
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="center">
                    <Text variant="headingLg" as="h3">
                      {customer.firstName} {customer.lastName}
                    </Text>
                    <Badge tone={customer.tier === "VIP" ? "success" : "info"}>
                      {customer.tier}
                    </Badge>
                  </InlineStack>
                  <Text as="p">{customer.email}</Text>
                  <Text as="p" variant="headingMd">
                    {customer.points} points
                  </Text>

                  {/* Manual Adjustment */}
                  <Form method="post">
                    <input type="hidden" name="intent" value="adjust" />
                    <input type="hidden" name="customerId" value={customer.id} />
                    <BlockStack gap="300">
                      <TextField
                        label="Point adjustment (use negative to deduct)"
                        name="delta"
                        type="number"
                        value={adjustDelta}
                        onChange={setAdjustDelta}
                        autoComplete="off"
                      />
                      <TextField
                        label="Reason"
                        name="reason"
                        value={adjustReason}
                        onChange={setAdjustReason}
                        autoComplete="off"
                      />
                      <Button submit loading={busy} tone="critical">Apply Adjustment</Button>
                    </BlockStack>
                  </Form>

                  {/* Transaction History */}
                  {txRows.length > 0 && (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={["Date", "Type", "Points", "Balance", "Description"]}
                      rows={txRows}
                    />
                  )}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
