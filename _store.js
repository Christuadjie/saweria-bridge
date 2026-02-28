// bridge/api/_store.js
// In-memory shared store untuk semua endpoint dalam 1 serverless instance
// CATATAN: Di Vercel, setiap cold start = state kosong.
// Untuk production dengan multiple instances, ganti dengan Upstash Redis
// (lihat README.md untuk instruksi upgrade ke Redis)

export const donations = [];
export let lastId = 0;

export function addDonation(donationData) {
  lastId++;
  const donation = {
    id: String(lastId),
    source: donationData.source || "saweria",
    donorName: donationData.donorName || donationData.donator_name || "Anonim",
    amount: Number(donationData.amount) || 0,
    currency: donationData.currency || "IDR",
    message: donationData.message || "",
    timestamp: Date.now(),
  };
  donations.push(donation);

  // Batasi 500 item
  if (donations.length > 500) {
    donations.splice(0, donations.length - 500);
  }

  return donation;
}
