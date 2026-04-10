import { useEffect, useState } from "react";
import {
  Page,
  Card,
  DataTable
} from "@shopify/polaris";

export default function CustomersPage() {

  const [rows, setRows] = useState([]);

  useEffect(() => {

    async function loadCustomers() {

      const res = await fetch("/api/getcustomer");
      const data = await res.json();

      const formatted = data.map((c) => [
        c.id,
        c.firstName,
        c.lastName,
         <Link url={`/app/regularcustomer/${c.shopifyId}${params}`} removeUnderline>
          {c.email}
          </Link>,
        c.birthday || "-",
        c.points,
        c.discountCode,
        new Date(c.createdAt).toLocaleDateString()
      ]);

      setRows(formatted);
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
            "numeric",
            "text",
            "text"
          ]}
          headings={[
            "ID",
            "First Name",
            "Last Name",
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