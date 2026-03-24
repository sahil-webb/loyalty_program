import { useEffect, useState } from "react";
import {
  Page,
  Card,
  DataTable
} from "@shopify/polaris";

export default function PremiumCustomersPage() {

  const [rows, setRows] = useState([]);

  useEffect(() => {

    async function loadCustomers() {

      const res = await fetch("/api/premiumcustomerlist");
      const data = await res.json();

      const formatted = data.map((c) => [
        c.id,
        c.shopifyId,
        c.email,
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
            "text"
          ]}
          headings={[
            "ID",
            "Shopify Customer ID",
            "Email",
            "Created"
          ]}
          rows={rows}
        />

      </Card>

    </Page>

  );
}