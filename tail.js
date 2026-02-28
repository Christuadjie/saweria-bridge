// bridge/api/tail.js
// GET /api/tail → return ID donasi terakhir
// Roblox memanggil ini saat startup agar donasi lama tidak di-replay

import { donations } from "./_store.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const last = donations.length > 0 ? donations[donations.length - 1] : null;

  return res.status(200).json({
    ok: true,
    id: last ? last.id : "0",
  });
}
