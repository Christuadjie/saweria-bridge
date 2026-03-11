// server.js
import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// FIX: Pisahkan middleware biar JSON tidak dibaca sebagai string
app.use((req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("application/json")) {
    express.json()(req, res, next);
  } else {
    express.text({ type: "*/*" })(req, res, next);
  }
});

// CORS supaya Roblox bisa akses
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-saweria-signature");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// Simpan donasi di memory
let donations = [];
let lastId = 0;

function addDonation(data) {
  lastId++;

  // Pakai amount_to_display (nominal asli yang donor bayar, tanpa potongan fee)
  // Fallback ke amount_raw / 100 kalau etc tidak ada
  const amount =
    Number(data.etc?.amount_to_display) ||
    Math.round((Number(data.amount_raw) || 0) / 100);

  const donation = {
    id: String(lastId),
    source: "saweria",
    donorName: data.donator_name || data.donorName || data.name || "Anonim",
    amount: amount,
    currency: data.currency || "IDR",
    message: data.message || "",
    timestamp: Date.now(),
  };

  donations.push(donation);
  if (donations.length > 500) donations.splice(0, donations.length - 500);

  console.log(`[DONATION] ${donation.donorName} - Rp ${donation.amount} | ID: ${donation.id}`);
  return donation;
}

// Cek server hidup
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Saweria Bridge aktif!", total: donations.length });
});

// Saweria kirim donasi ke sini
app.post("/api/webhook", (req, res) => {
  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const signature = req.headers["x-saweria-signature"] || "";
    const secret = process.env.SAWERIA_WEBHOOK_SECRET || "";

    if (secret) {
      const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      if (expected !== signature) {
        return res.status(401).json({ ok: false, reason: "Invalid signature" });
      }
    }

    // Parse body dengan aman
    let data;
    if (typeof req.body === "object" && req.body !== null) {
      data = req.body;
    } else {
      try {
        data = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ ok: false, reason: "Invalid JSON payload" });
      }
    }

    console.log("[WEBHOOK] Data diterima:", JSON.stringify(data));
    console.log("[RAW AMOUNT]", data.amount_raw, "| amount_to_display:", data.etc?.amount_to_display);

    const donation = addDonation(data);
    return res.status(200).json({ ok: true, id: donation.id });
  } catch (e) {
    console.error("Error webhook:", e.message);
    return res.status(400).json({ ok: false, reason: "Invalid payload" });
  }
});

// Roblox ambil donasi baru
app.get("/api/donations", (req, res) => {
  const afterNum = parseInt(req.query.after) || 0;
  const items = donations.filter((d) => parseInt(d.id) > afterNum);
  res.json({ ok: true, items, count: items.length });
});

// Roblox ambil ID terakhir saat startup
app.get("/api/tail", (req, res) => {
  const last = donations.length > 0 ? donations[donations.length - 1] : null;
  res.json({ ok: true, id: last ? last.id : "0" });
});

app.listen(PORT, () => {
  console.log(`[BRIDGE] Server jalan di port ${PORT}`);
});
