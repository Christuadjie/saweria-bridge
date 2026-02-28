// bridge/api/webhook.js
// Saweria Webhook Handler
// Deploy ke Vercel: https://vercel.com
//
// CARA SETUP:
// 1. Deploy folder bridge/ ini ke Vercel
// 2. Set environment variable SAWERIA_WEBHOOK_SECRET (opsional, untuk keamanan)
// 3. Di dashboard Saweria → Settings → Webhook URL: https://NAMA.vercel.app/api/webhook
// 4. Di DonationConfig.luau, set OVERRIDE_BRIDGE_URL = "https://NAMA.vercel.app"

import crypto from "crypto";
import { addDonation } from "./_store.js";

function verifySaweriaSignature(body, signature, secret) {
  if (!secret) return true;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(typeof body === "string" ? body : JSON.stringify(body))
    .digest("hex");
  return expected === signature;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-saweria-signature");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "Method not allowed" });
  }

  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const signature = req.headers["x-saweria-signature"] || "";
    const secret = process.env.SAWERIA_WEBHOOK_SECRET || "";

    if (secret && !verifySaweriaSignature(rawBody, signature, secret)) {
      console.warn("[DONATION] Signature tidak valid, request ditolak");
      return res.status(401).json({ ok: false, reason: "Invalid signature" });
    }

    const data = typeof req.body === "object" ? req.body : JSON.parse(rawBody);

    // Saweria webhook payload format:
    // { donator_name, amount, message, currency, type, media, created_at }
    const donation = addDonation({
      source: "saweria",
      donorName: data.donator_name || data.name || "Anonim",
      amount: data.amount,
      currency: data.currency || "IDR",
      message: data.message || "",
    });

    console.log(
      `[DONATION] ✓ Saweria: ${donation.donorName} - Rp ${donation.amount} | ID: ${donation.id}`
    );
    return res.status(200).json({ ok: true, id: donation.id });
  } catch (e) {
    console.error("[DONATION] Error:", e.message);
    return res.status(400).json({ ok: false, reason: "Invalid payload" });
  }
}
