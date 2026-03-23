import { useEffect, useState } from "react";
import { Page, Card, TextField, Button, Layout, Banner } from "@shopify/polaris";

export default function RulePage() {
  const [points, setPoints] = useState("");
  const [dollar, setDollar] = useState("");
  const [status, setStatus] = useState({ message: "", type: "" });

  // Load current rule from DB
  useEffect(() => {
    fetch("/api/rule")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setPoints(data.pointsPerUnit);
          setDollar(data.currencyUnit);
        }
      })
      .catch(() => {
        setStatus({ message: "Failed to load rule", type: "critical" });
      });
  }, []);

  // Save rule
  async function saveRule() {
    setStatus({ message: "Saving...", type: "info" });

    try {
      const res = await fetch("/api/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, dollar })
      });

      if (res.ok) {
        setStatus({ message: "Saved successfully", type: "success" });
      } else {
        setStatus({ message: "Failed to save", type: "critical" });
      }
    } catch (err) {
      setStatus({ message: "Failed to save", type: "critical" });
    }
  }

  return (
    <Page title="Reward Conversion Rule">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            {status.message && (
              <Banner status={status.type} title={status.message} />
            )}

            <div style={{ marginBottom: "16px" }}>
              <TextField
                label="Points"
                type="number"
                value={points}
                onChange={(value) => setPoints(value)}
                helpText="Number of points per currency unit"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <TextField
                label="Dollar"
                type="number"
                value={dollar}
                onChange={(value) => setDollar(value)}
                helpText="Amount in dollars for conversion"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <Button primary onClick={saveRule}>
                Save Rule
              </Button>
            </div>

            {points && dollar && (
              <div>
                <p>
                  Current rule: <strong>{points} points</strong> ={" "}
                  <strong>{dollar} dollar</strong>
                </p>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
