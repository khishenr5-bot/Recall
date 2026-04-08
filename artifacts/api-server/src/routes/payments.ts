import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { VerifyPaymentBody } from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

router.post("/payment/create-order", requireAuth, async (req, res): Promise<void> => {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpayKeySecret) {
    res.status(503).json({ error: "Payment service not configured" });
    return;
  }

  try {
    const amount = 49900; // ₹499 in paise
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64"),
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `recall_${Date.now()}`,
      }),
    });

    if (!response.ok) {
      res.status(500).json({ error: "Failed to create payment order" });
      return;
    }

    const order = await response.json() as { id: string };
    res.json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: razorpayKeyId,
    });
  } catch (err) {
    req.log.error({ err }, "Payment order creation failed");
    res.status(500).json({ error: "Payment service error" });
  }
});

router.post("/payment/verify", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeySecret) {
    res.status(503).json({ error: "Payment service not configured" });
    return;
  }

  const parsed = VerifyPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { orderId, paymentId, signature } = parsed.data;
  const expectedSignature = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSignature !== signature) {
    res.status(400).json({ error: "Invalid payment signature" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ plan: "pro", savesLimit: 999999 })
    .where(eq(usersTable.id, user.id))
    .returning();

  if (!updated) {
    res.status(500).json({ error: "Failed to upgrade account" });
    return;
  }

  res.json({
    id: updated.id,
    email: updated.email,
    username: updated.username,
    plan: updated.plan,
    monthlySavesCount: updated.monthlySavesCount,
    savesLimit: updated.savesLimit,
    preferredLanguage: updated.preferredLanguage,
    onboardingCompleted: updated.onboardingCompleted,
    createdAt: updated.createdAt,
  });
});

export default router;
