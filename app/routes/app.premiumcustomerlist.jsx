import { useEffect, useState } from "react";
import {
  Page,
  Card,
  DataTable,
  Link
} from "@shopify/polaris";

export default function PremiumCustomersPage() {

  const [rows, setRows] = useState([]);

  useEffect(() => {

    async function loadCustomers() {

      const res = await fetch("/api/premiumcustomerlist");
      const data = await res.json();

      // keep shop + host params so Shopify doesn't ask login again
      const params = window.location.search;

      const formatted = data.map((c) => [
        c.id,
        c.birthday,
        c.shopifyId,
        <Link url={`/app/premiumcustomer/${c.shopifyId}${params}`} removeUnderline>
          {c.email}
        </Link>,
        c.coins,
        c.discountCode || "-",
        new Date(c.createdAt).toLocaleDateString()
      ]);

      setRows(formatted);
    }

    loadCustomers();

  }, []);

  return (

    <Page title="Premium Customers">

      <Card>

        <DataTable
          columnContentTypes={[
            "numeric",
            "text",
            "text",
            "text",
            "numeric",
            "text",
            "text"
          ]}
          headings={[
            "ID",
            "Birthday",
            "Shopify Customer ID",
            "Email",
            "Coins",
            "Discount",
            "Created"
          ]}
          rows={rows}
        />

      </Card>

    </Page>

  );
}