import { useEffect, useState } from "react";
import {
  Page,
  Card,
  Layout,
  Text,
  DataTable
} from "@shopify/polaris";

export default function PremiumCustomerDetail() {

  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);

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

  if (!customer) {
    return <Page title="Loading..." />;
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

    <Page title={`${customer.firstName} ${customer.lastName}`}>

      <Layout>

        <Layout.Section>

          <Card title="Customer Information" sectioned>

            <Text><b>Name:</b> {customer.firstName} {customer.lastName}</Text>

            <br />

            <Text><b>Email:</b> {customer.email}</Text>

            <br />

            <Text><b>Phone:</b> {customer.phone || "-"}</Text>

            <br />

            <Text><b>Address:</b> {customer.address || "-"}</Text>

          </Card>

        </Layout.Section>

        <Layout.Section>

          <Card title="Loyalty Information" sectioned>

            <Text><b>Available Points:</b> {customer.points}</Text>

            <br />

            <Text><b>Tier:</b> {customer.tier}</Text>

            <br />

            <Text><b>Referral Code:</b> {customer.referralCode || "-"}</Text>

            <br />

            <Text><b>Discount Code:</b> {customer.discountCode || "-"}</Text>

            <br />

            <Text>
              <b>Joined:</b> {new Date(customer.createdAt).toLocaleDateString()}
            </Text>

          </Card>

        </Layout.Section>

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