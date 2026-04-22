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
  Divider,
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

  const [totalCustomers, vipCount, residentCount] = await Promise.all([
    db.loyaltyCustomer.count({ where: { shop } }),
    db.loyaltyCustomer.count({ where: { shop, tier: Tier.VIP } }),
    db.loyaltyCustomer.count({ where: { shop, tier: Tier.RESIDENT } }),
  ]);

  return { shop, totalCustomers, vipCount, residentCount };
};

type CustomerResult = {
  id: number;
  shopifyId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: Tier;
  points: number;
  vipExpiresAt: string | null; // serialized Date
  referralCode: string;
  transactions: Array<{
    id: number;
    type: string;
    points: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
  }>;
};

// ─── Action ────────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const form = await request.formData();
  const intent = form.get("intent") as string;

  // ── Search ──────────────────────────────────────────────────────────────────
  if (intent === "search") {
    const query = (form.get("query") as string)?.trim();
    if (!query) return { customer: null, error: "Enter an email or Shopify customer ID." };

    const customer = await db.loyaltyCustomer.findFirst({
      where: {
        shop,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { shopifyId: { contains: query } },
        ],
      },
      include: {
        transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    return { customer: customer ?? null, error: customer ? null : "No customer found." };
  }

  // ── Point Adjustment ────────────────────────────────────────────────────────
  if (intent === "adjust") {
    const customerId = parseInt(form.get("customerId") as string);
    const delta = parseInt(form.get("delta") as string);
    const reason = (form.get("reason") as string)?.trim() || "Manual adjustment";

    if (isNaN(customerId) || isNaN(delta) || delta === 0)
      return { customer: null, error: "Invalid adjustment." };

    const customer = await db.loyaltyCustomer.findUnique({ where: { id: customerId } });
    if (!customer || customer.shop !== shop) return { customer: null, error: "Customer not found." };

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

    const updated = await db.loyaltyCustomer.findUnique({
      where: { id: customerId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    return { customer: updated, error: null };
  }

  // ── Set Tier (VIP upgrade / downgrade) ──────────────────────────────────────
  if (intent === "setTier") {
    const customerId = parseInt(form.get("customerId") as string);
    const newTier = form.get("tier") as Tier;

    if (!customerId || !["RESIDENT", "VIP"].includes(newTier))
      return { customer: null, error: "Invalid tier." };

    const customer = await db.loyaltyCustomer.findUnique({ where: { id: customerId } });
    if (!customer || customer.shop !== shop) return { customer: null, error: "Customer not found." };

    const isUpgrade = newTier === Tier.VIP;
    const vipExpiresAt = isUpgrade
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : null;

    await db.$transaction([
      db.loyaltyCustomer.update({
        where: { id: customerId },
        data: { tier: newTier, vipExpiresAt },
      }),
      db.rewardTransaction.create({
        data: {
          shop,
          shopifyId: customer.shopifyId,
          type: isUpgrade ? "VIP_JOIN" : "ADJUSTMENT",
          points: 0,
          balanceAfter: customer.points,
          description: isUpgrade
            ? `VIP manually activated — expires ${vipExpiresAt?.toLocaleDateString()}`
            : "Downgraded to Residence Insider",
        },
      }),
      db.auditLog.create({
        data: {
          shop,
          action: "TIER_CHANGE",
          entityId: String(customerId),
          before: { tier: customer.tier },
          after: { tier: newTier },
        },
      }),
    ]);

    const updated = await db.loyaltyCustomer.findUnique({
      where: { id: customerId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    return { customer: updated, error: null };
  }

  return { customer: null, error: "Unknown action." };
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { totalCustomers, vipCount, residentCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  const [searchQuery, setSearchQuery] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const customer = actionData?.customer as CustomerResult | null ?? null;
  const error = actionData?.error ?? null;

  const txRows =
    customer?.transactions.map((tx) => [
      new Date(tx.createdAt).toLocaleDateString(),
      tx.type,
      tx.points > 0 ? `+${tx.points}` : String(tx.points),
      String(tx.balanceAfter),
      tx.description ?? "—",
    ]) ?? [];

  const isVip = customer?.tier === "VIP";
  const vipExpiry = customer?.vipExpiresAt
    ? new Date(customer.vipExpiresAt).toLocaleDateString()
    : null;
  const vipActive = isVip && customer?.vipExpiresAt && new Date(customer.vipExpiresAt) > new Date();

  return (
    <Page title="Residence Rewards">
      <Layout>
        {/* Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" tone="subdued">Total Members</Text>
                <Text variant="heading2xl" as="p">{totalCustomers}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" tone="subdued">Residence Insider</Text>
                <Text variant="heading2xl" as="p">{residentCount}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" tone="subdued">Residence VIP</Text>
                <Text variant="heading2xl" as="p">{vipCount}</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Customer Lookup */}
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
                <BlockStack gap="500">
                  {/* Customer header */}
                  <InlineStack gap="300" blockAlign="center">
                    <Text variant="headingLg" as="h3">
                      {customer.firstName} {customer.lastName}
                    </Text>
                    <Badge tone={vipActive ? "success" : "info"}>
                      {vipActive ? "Residence VIP" : "Residence Insider"}
                    </Badge>
                  </InlineStack>

                  <BlockStack gap="100">
                    <Text as="p" tone="subdued">{customer.email}</Text>
                    {vipExpiry && (
                      <Text as="p" tone="subdued">
                        VIP expires: {vipExpiry}
                      </Text>
                    )}
                    <Text as="p" variant="headingMd">{customer.points} pts</Text>
                    <Text as="p" tone="subdued">Referral code: {customer.referralCode}</Text>
                  </BlockStack>

                  <Divider />

                  {/* Tier Controls */}
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">Membership</Text>
                    <InlineStack gap="300">
                      {!vipActive && (
                        <Form method="post">
                          <input type="hidden" name="intent" value="setTier" />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <input type="hidden" name="tier" value="VIP" />
                          <Button submit loading={busy} variant="primary">
                            Upgrade to VIP (+1 year)
                          </Button>
                        </Form>
                      )}
                      {vipActive && (
                        <Form method="post">
                          <input type="hidden" name="intent" value="setTier" />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <input type="hidden" name="tier" value="RESIDENT" />
                          <Button submit loading={busy} tone="critical" variant="plain">
                            Remove VIP
                          </Button>
                        </Form>
                      )}
                    </InlineStack>
                  </BlockStack>

                  <Divider />

                  {/* Point Adjustment */}
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">Adjust Points</Text>
                    <Form method="post">
                      <input type="hidden" name="intent" value="adjust" />
                      <input type="hidden" name="customerId" value={customer.id} />
                      <BlockStack gap="300">
                        <TextField
                          label="Points (negative to deduct)"
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
                        <Button submit loading={busy}>Apply</Button>
                      </BlockStack>
                    </Form>
                  </BlockStack>

                  {/* Transaction History */}
                  {txRows.length > 0 && (
                    <>
                      <Divider />
                      <Text variant="headingMd" as="h3">Transaction History</Text>
                      <DataTable
                        columnContentTypes={["text", "text", "text", "text", "text"]}
                        headings={["Date", "Type", "Points", "Balance", "Description"]}
                        rows={txRows}
                      />
                    </>
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
