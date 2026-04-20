import { useEffect, useState } from "react";
import {
  Page,
  Card,
  Layout,
  Text,
  DataTable,
  TextField,
  Select,
  Button
} from "@shopify/polaris";

export default function PremiumCustomerDetail() {

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // ✅ NEW STATE (ADDED)
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState("ADD");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    const path = window.location.pathname;
    const shopifyId = path.split("/").pop();

    async function loadCustomer() {

      const res = await fetch(`/api/premiumcustomer/${shopifyId}`);
      const data = await res.json();

      setCustomer(data.customer);
      setTransactions(data.transactions);
    }

    loadCustomer();

  }, []);

  // ✅ NEW FUNCTION (ADDED)
  async function handleAdjust() {
    try {
      setLoading(true);

      const res = await fetch("/api/adjustPremiumCustomer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          shopifyId: customer.shopifyId,
          amount: parseInt(adjustAmount),
          type: adjustType,
          description: adjustDesc
        })
      });

      const data = await res.json();

      console.log("✅ Adjust Response:", data);

      window.location.reload();

    } catch (err) {
      console.error("❌ Adjust error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!customer) {
    return <Page title="Loading customer..." />;
  }

  const rows = transactions.map((t) => [
    t.id,
    t.type,
    t.points,
    t.availablePoints,
    t.description || "-",
    t.orderId || "-",
    new Date(t.createdAt).toLocaleString()
  ]);

  return (

    <Page title={`${customer.firstName || ""} ${customer.lastName || ""}`}>

      <Layout>

        {/* Shopify Customer Info */}
        <Layout.Section>
          <Card title="Customer Information" sectioned>

            <Text><b>Name:</b> {customer.firstName || "-"} {customer.lastName || "-"}</Text>
            <br />

            <Text><b>Email:</b> {customer.email}</Text>
            <br />

            <Text><b>Phone:</b> {customer.phone || "-"}</Text>
            <br />

            <Text><b>Address:</b> {customer.address || "-"}</Text>

          </Card>
        </Layout.Section>

        {/* Loyalty Info */}
        <Layout.Section>
          <Card title="Loyalty Wallet" sectioned>

            <Text><b>Coins:</b> {customer.coins}</Text>
            <br />

            <Text><b>Tier:</b> {customer.tier}</Text>
            <br />

            <Text><b>Referral Code:</b> {customer.referralCode || "-"}</Text>
            <br />

            <Text><b>Signed With Referral:</b> {customer.signInWithReferral ? "Yes" : "No"}</Text>
            <br />

            <Text><b>Referral Used:</b> {customer.signInReferralCode || "-"}</Text>
            <br />

            <Text><b>Discount Code:</b> {customer.discountCode || "-"}</Text>
            <br />

            <Text>
              <b>Loyalty Joined:</b>{" "}
              {customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString()
                : "-"}
            </Text>

          </Card>
        </Layout.Section>

        {/* ✅ NEW ADJUSTMENT SECTION */}
        <Layout.Section>

          <Card title="Adjust Coins" sectioned>

            <div style={{ marginBottom: "10px" }}>
              <TextField
                label="Amount"
                type="number"
                value={adjustAmount}
                onChange={setAdjustAmount}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <Select
                label="Type"
                options={[
                  { label: "Add Coins", value: "ADD" },
                  { label: "Deduct Coins", value: "DEDUCT" }
                ]}
                value={adjustType}
                onChange={setAdjustType}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <TextField
                label="Description"
                value={adjustDesc}
                onChange={setAdjustDesc}
              />
            </div>

            <Button primary loading={loading} onClick={handleAdjust}>
              Submit Adjustment
            </Button>

          </Card>

        </Layout.Section>

        {/* Transaction History */}
        <Layout.Section>

          <Card title="Points Transaction History">

            <DataTable
              columnContentTypes={[
                "numeric",
                "text",
                "numeric",
                "numeric",
                "text",
                "text",
                "text"
              ]}
              headings={[
                "ID",
                "Type",
                "Points",
                "Balance",
                "Description",
                "Order",
                "Date"
              ]}
              rows={rows}
            />

          </Card>

        </Layout.Section>

      </Layout>

    </Page>
  );
}