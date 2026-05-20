import { adminDb } from '@/utils/firebaseAdmin';
import reviewsData from '@/utils/reviews.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });

  try {
    if (!adminDb) {
      console.error('[seed-reviews] adminDb not initialized');
      return res.status(500).json({ error: 'adminDb not initialized' });
    }
  const names = Array.isArray(reviewsData.names) ? reviewsData.names : [];
  const reviews = Array.isArray(reviewsData.reviews) ? reviewsData.reviews : [];
  // Always generate exactly 10 reviews
  const toGenerate = 10;

  // Random date between 2025-01-02 and 2025-09-09 (inclusive)
  const start = new Date('2025-01-02T00:00:00Z').getTime();
  const end = new Date('2025-09-09T23:59:59Z').getTime();
  const randDate = () => new Date(start + Math.floor(Math.random() * (end - start + 1)));

    const created = [];
    for (let i = 0; i < toGenerate; i++) {
      const name = names[Math.floor(Math.random() * names.length)] || 'Pembeli';
      const rev = reviews[Math.floor(Math.random() * reviews.length)] || { comment: 'Good', rating: 5 };
      const docRef = adminDb.collection('reviews').doc();
      // Ensure rating is an integer between 3 and 5 for realistic distribution
      const rating = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
      const data = {
        productId: String(productId),
        name,
        comment: rev.comment,
        rating,
        createdAt: randDate()
      };
      await adminDb.collection('reviews').doc(docRef.id).set(data);
      created.push({ id: docRef.id, ...data });
    }

    console.log(`[seed-reviews] created ${created.length} reviews for product ${productId}`);
    return res.status(200).json({ ok: true, created });
  } catch (err) {
    console.error('seed-reviews error', err);
    return res.status(500).json({ error: 'failed' });
  }
}
