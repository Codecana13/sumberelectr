import { adminDb } from '@/utils/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const fallback = process.env.NEXT_PUBLIC_ADMIN_WA || process.env.ADMIN_WA || null;
    const result = await adminDb.runTransaction(async (t) => {
      const ref = adminDb.collection('settings').doc('whatsapp');
      const snap = await t.get(ref);
      const data = snap.exists ? (snap.data() || {}) : {};
      const numbers = Array.isArray(data.numbers) ? data.numbers : [];
      if (!numbers.length) {
        return { number: fallback, rotated: false };
      }
      let idx = Number.isInteger(data.rotationIndex) ? data.rotationIndex : 0;
      if (idx < 0 || idx >= numbers.length) idx = 0;
      const number = numbers[idx];
      const nextIdx = (idx + 1) % numbers.length;
      t.set(ref, { rotationIndex: nextIdx }, { merge: true });
      return { number, rotated: true, nextIdx };
    });
    if (!result.number) {
      return res.status(200).json({ number: null, note: 'No WA numbers configured' });
    }
    return res.status(200).json({ number: result.number, rotated: !!result.rotated });
  } catch (e) {
    console.error('whatsapp/next error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
