import { adminDb } from '@/utils/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const key = process.env.BITESHIP_API_KEY;
    if (!key) return res.status(500).json({ error: 'Missing BITESHIP_API_KEY' });

    // (Opsional) caching sederhana 5 menit via Firestore
    const cacheRef = adminDb.collection('_cache').doc('biteship_cxl_reasons');
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const d = cacheSnap.data();
      if (d.expiresAt && d.expiresAt.toMillis() > Date.now()) {
        return res.json({ fromCache: true, reasons: d.reasons || [] });
      }
    }

    const r = await fetch('https://api.biteship.com/v1/orders/cancellation_reasons?lang=id', {
      headers: { Authorization: `Bearer ${key}` }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.message || 'Fetch reasons failed' });

    await cacheRef.set({
      reasons: data?.cancellation_reasons || data?.data || data || [],
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000)
    }, { merge: true });

    return res.json({ reasons: data?.cancellation_reasons || data?.data || data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}