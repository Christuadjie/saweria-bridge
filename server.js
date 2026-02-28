// server.js
// Express server untuk Railway
// Menggantikan Vercel serverless functions

import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON body
app.use(express.json());
app.use(express.text({ type: "*/*" }));

// CORS - supaya Roblox bisa akses
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-saweria-signature");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// ============================================================
// IN-MEMORY STORE
// ============================================================
let donations = [];
let lastId = 0;

function addDonation(data) {
  lastId++;
  const donation = {
    id: String(lastId),
    source: "saweria",
    donorName: data.donator_name || data.donorName || data.name || "Anonim",
    amount: Number(data.amount) || 0,
    currency: data.currency || "IDR",
    message: data.message || "",
    timestamp: Date.now(),
  };
  donations.push(donation);

  // Batasi 500 item
  if (donations.length > 500) {
    donations.splice(0, donations.length - 500);
  }

  console.log(`[DONATION] ✓ ${donation.donorName} - Rp ${donation.amount} | ID: ${donation.id}`);
  return donation;
}

// ============================================================
// ROUTES
// ============================================================

// Cek server hidup
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Saweria Bridge aktif", donations: donations.length });
});

// POST /api/webhook — terima donasi dari Saweria
app.post("/api/webhook", (req, res) => {
  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const signature = req.headers["x-saweria-signature"] || "";
    const secret = process.env.SAWERIA_WEBHOOK_SECRET || "";

    // Verifikasi signature (opsional)
    if (secret) {
      const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      if (expected !== signature) {
        console.warn("[DONATION] Signature tidak valid");
        return res.status(401).json({ ok: false, reason: "Invalid signature" });
      }
    }

    const data = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
    const donation = addDonation(data);
    return res.status(200).json({ ok: true, id: donation.id });
  } catch (e) {
    console.error("[DONATION] Error webhook:", e.message);
    return res.status(400).json({ ok: false, reason: "Invalid payload" });
  }
});

// GET /api/donations?after=ID — Roblox poll donasi baru
app.get("/api/donations", (req, res) => {
  const afterNum = parseInt(req.query.after) || 0;
  const items = donations.filter((d) => parseInt(d.id) > afterNum);
  res.json({ ok: true, items, count: items.length });
});

// GET /api/tail — ambil ID donasi terakhir (dipanggil Roblox saat startup)
app.get("/api/tail", (req, res) => {
  const last = donations.length > 0 ? donations[donations.length - 1] : null;
  res.json({ ok: true, id: last ? last.id : "0" });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`[BRIDGE] Server berjalan di port ${PORT}`);
});
