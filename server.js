// server.js
import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// PENTING: pakai raw body dulu sebelum parser lain
app.use((req, res, next) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    req.rawBody = raw;
    try {
      req.parsedBody = JSON.parse(raw);
    } catch {
      req.parsedBody = null;
    }
    next();
  });
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

/**
 * Saweria payload struktur aktual:
 * {
 *   "amount_raw": 50354,       ← nominal + fee (JANGAN PAKAI INI)
 *   "amount_to_display": 50000 ← nominal asli yang harus ditampilkan ✅
 *   "cut": -2854,              ← potongan fee
 *   "donator_name": "...",
 *   "message": "...",
 * }
 */
function addDonation(data) {
  lastId++;

  // amount_to_display ada di dalam data.etc (bukan di root!)
  // Fallback ke amount_raw jika etc tidak ada
  const rawAmount =
    (data.etc && data.etc.amount_to_display != null ? data.etc.amount_to_display : null) ??
    data.amount_to_display ??
    data.amount_raw ??
    0;

  const donation = {
    id: String(lastId),
    source: "saweria",
    donorName:
      data.donator_name ||
      data.donorName ||
      data.donor_name ||
      data.name ||
      "Anonim",
    amount: Number(rawAmount) || 0,
    currency: data.currency || "IDR",
    message: data.message || "",
    timestamp: Date.now(),
  };

  donations.push(donation);
  if (donations.length > 500) donations.splice(0, donations.length - 500);
  console.log(
    `[DONATION] ${donation.donorName} - Rp ${donation.amount.toLocaleString("id-ID")} | ID: ${donation.id}`
  );
  return donation;
}

// Cek server hidup
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Saweria Bridge aktif!", total: donations.length });
});

// Saweria kirim donasi ke sini
app.post("/api/webhook", (req, res) => {
  try {
    const rawBody = req.rawBody || "";
    // Saweria pakai header "saweria-callback-signature" (bukan x-saweria-signature)
    const signature =
      req.headers["saweria-callback-signature"] ||
      req.headers["x-saweria-signature"] || "";
    const secret = process.env.SAWERIA_WEBHOOK_SECRET || "";

    // LOG RAW PAYLOAD — untuk debug struktur Saweria
    console.log("=== [WEBHOOK RAW] ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", rawBody);
    console.log("====================");

    // Verifikasi signature jika secret di-set
    if (secret) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
      if (expected !== signature) {
        console.warn("[WEBHOOK] Signature mismatch! Expected:", expected, "Got:", signature);
        return res.status(401).json({ ok: false, reason: "Invalid signature" });
      }
    }

    const data = req.parsedBody;
    if (!data) {
      return res.status(400).json({ ok: false, reason: "Invalid JSON payload" });
    }

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
