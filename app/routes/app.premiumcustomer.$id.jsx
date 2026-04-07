import { useEffect, useState } from "react";
import { Page, Card, Text } from "@shopify/polaris";

export default function PremiumCustomerDetail() {

  const [customer, setCustomer] = useState(null);

  useEffect(() => {

    const path = window.location.pathname;
    const id = path.split("/").pop();

    async function loadCustomer() {

      const res = await fetch(`/api/premiumcustomer/${id}`);
      const data = await res.json();

      setCustomer(data);
    }

    loadCustomer();

  }, []);

  if (!customer) {
    return <Page title="Loading..." />;
  }

  return (

    <Page title={`Customer: ${customer.email}`}>

      <Card sectioned>

        <Text variant="headingMd">Customer Details</Text>

        <p><b>Email:</b> {customer.email}</p>
        <p><b>Coins:</b> {customer.coins}</p>
        <p><b>Discount Code:</b> {customer.discountCode}</p>
        <p><b>Referral Code:</b> {customer.referralCode}</p>
        <p><b>Joined:</b> {new Date(customer.createdAt).toLocaleDateString()}</p>

      </Card>

    </Page>
  );
}