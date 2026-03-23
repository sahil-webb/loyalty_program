import prisma from "../db.server";
import { authenticate } from "../shopify.server";

/* ================= GET ACTIVE RULE ================= */
export async function loader() {
  try {
    const rule = await prisma.rewardRule.findFirst({
      where: { isActive: true }
    });

    return new Response(JSON.stringify(rule), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Loader error:", error);
    return new Response("Failed to load rule", { status: 500 });
  }
}

/* ================= SAVE RULE ================= */
export async function action({ request }) {
  try {
    // Authenticate admin (optional, keeps admin only)
    const { admin } = await authenticate.admin(request);
    if (!admin) throw new Error("Admin authentication failed");

    // Parse request body
    const body = await request.json();
    const pointsPerUnit = parseFloat(body.points);
    const currencyUnit = parseFloat(body.dollar);

    if (!pointsPerUnit || !currencyUnit) {
      return new Response("Invalid points or dollar value", { status: 400 });
    }

    // Deactivate old rules
    await prisma.rewardRule.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Create new active rule
    const rule = await prisma.rewardRule.create({
      data: {
        pointsPerUnit,
        currencyUnit,
        isActive: true
      }
    });

    return new Response(JSON.stringify(rule), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Rule Save Error:", error);
    return new Response("Failed to save rule", { status: 500 });
  }
}
