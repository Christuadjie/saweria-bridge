// bridge/api/donations.js
// Endpoint yang di-poll oleh Roblox server untuk mengambil donasi baru
// GET /api/donations?after=LAST_ID

// Import shared state (note: di Vercel serverless, state ini hanya shared dalam 1 instance)
// Untuk production multi-instance, gunakan Upstash Redis (lihat README)
import { donations } from "./_store.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false });

  const afterId = req.query.after || "";
  const afterNum = parseInt(afterId) || 0;

  // Ambil donasi dengan id > afterId
  const items = donations.filter((d) => parseInt(d.id) > afterNum);

  return res.status(200).json({
    ok: true,
    items: items,
    count: items.length,
  });
}
