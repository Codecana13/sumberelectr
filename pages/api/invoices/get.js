import { adminDb } from '@/utils/firebaseAdmin';

export default async function handler(req, res) {
  try {
    const method = req.method || 'GET';
    if (!['GET', 'POST'].includes(method)) return res.status(405).json({ error: 'Method not allowed' });
    const invoiceId = method === 'GET' ? (req.query.invoiceId || req.query.id) : (req.body?.invoiceId || req.body?.id);
    if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required' });
    const snap = await adminDb.collection('invoices').doc(String(invoiceId)).get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const data = snap.data();
    return res.status(200).json({ id: snap.id, ...data });
  } catch (e) {
    console.error('invoices/get error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
