import { adminDb } from '@/utils/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { invoiceId, reasonCode, reasonText } = req.body || {};
    if (!invoiceId || !reasonCode) {
      return res.status(400).json({ error: 'invoiceId & reasonCode required' });
    }

    const key = process.env.BITESHIP_API_KEY;
    if (!key) return res.status(500).json({ error: 'Missing BITESHIP_API_KEY' });

    // Ambil invoice
    const ref = adminDb.collection('invoices').doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Invoice not found' });

    const inv = snap.data();
    const orderId = inv.codOrderId || inv.waybillId || inv.extra?.id;
    // Jika tidak ada orderId Biteship tetap lanjut (soft cancel lokal)
    let biteshipResponse = null;

    if (orderId) {
      // Endpoint pembatalan Biteship (umum: POST /v1/orders/{id}/cancel)
      const resp = await fetch(`https://api.biteship.com/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cancellation_reason_code: reasonCode,
          cancellation_reason: reasonText || ''
        })
      });
      const json = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ error: json?.message || 'Cancel failed', biteship: json });
      }
      biteshipResponse = json;
    }

    // Arsipkan lalu hapus
    const archiveRef = adminDb.collection('invoices_archive').doc(invoiceId);
    await adminDb.runTransaction(async t => {
      t.set(archiveRef, {
        ...inv,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedReasonCode: reasonCode,
        archivedReasonText: reasonText || '',
        archivedBy: 'admin_api',
        biteshipCancel: biteshipResponse || null,
        finalStatus: 'cancelled'
      });
      t.delete(ref);
    });

    return res.json({
      success: true,
      message: 'Invoice cancelled & archived',
      biteship: biteshipResponse
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}