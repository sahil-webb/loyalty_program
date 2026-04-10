import { useEffect, useState } from "react";
import {
  Page,
  Card,
  DataTable,
  Link
} from "@shopify/polaris";

export default function CustomersPage() {

  const [rows, setRows] = useState([]);

  useEffect(() => {

    async function loadCustomers() {

      try {

        const res = await fetch("/api/getcustomer");
        const data = await res.json();

        const customers = data.customers || [];

        const formatted = customers.map((c) => [
          c.id,
          c.firstName,
          c.lastName,
          c.shopifyId,
          <Link url={`/app/regularcustomer/${c.shopifyId}`} removeUnderline>
            {c.email}
          </Link>,
          c.birthday || "-",
          c.points,
          c.discountCode || "-",
          new Date(c.createdAt).toLocaleDateString()
        ]);

        setRows(formatted);

      } catch (error) {

        console.error("Failed to load customers:", error);

      }

    }

    loadCustomers();

  }, []);

  return (

    <Page title="Reward Customers">

      <Card>

        <DataTable
          columnContentTypes={[
            "numeric",
            "text",
            "text",
            "text",
            "text",
            "text",
            "numeric",
            "text",
            "text"
          ]}
          headings={[
            "ID",
            "First Name",
            "Last Name",
            "Shopify ID",
            "Email",
            "Birthday",
            "Points",
            "Discount",
            "Created"
          ]}
          rows={rows}
        />

      </Card>

    </Page>

  );

}