import { adminDb } from '@/utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore'; // <-- tambah
import fetch from 'node-fetch';
import { sendDeliveryStatusEmail } from '@/utils/mailer';

export default async function handler(req, res) {
  try {
    const { invoiceId, biteshipId } = req.query;

    let biteshipOrderId = biteshipId || null;
    let invoiceRef = null;
    let inv = null;
    if (invoiceId) {
      invoiceRef = adminDb.collection('invoices').doc(String(invoiceId));
      const snap = await invoiceRef.get();
      if (snap.exists) {
        inv = { id: snap.id, ...snap.data() };
        // fallback id
        biteshipOrderId =
          biteshipOrderId ||
          inv?.biteshipOrderId ||
          inv?.trackingOrderId ||
          inv?.codOrderId ||
          inv?.extra?.id ||
          null;
      }
    }

    if (!biteshipOrderId) {
      return res.status(400).json({ error: 'Missing Biteship order id' });
    }

    // Panggil Biteship Retrieve Order
    const upstream = await fetch(`https://api.biteship.com/v1/orders/${encodeURIComponent(biteshipOrderId)}`, {
      headers: { Authorization: `Bearer ${process.env.BITESHIP_API_KEY || process.env.NEXT_PUBLIC_BITESHIP_API_KEY}` }
    });
    const data = await upstream.json();

    if (!upstream.ok || data.success === false) {
      return res.status(upstream.status || 500).json({ error: data.error || 'Retrieve failed', detail: data });
    }

    // Simpan ke invoice (jika ada)
    if (invoiceRef && data) {
      const updates = {
        updatedAt: FieldValue.serverTimestamp(), // <-- perbaikan
        'extra.id': data.id || biteshipOrderId,
        biteshipRaw: data,
        biteshipStatus: data.status || data?.courier?.status || inv?.biteshipStatus || null,
        waybillId: data?.courier?.waybill_id || inv?.waybillId || null
      };
      await invoiceRef.set(updates, { merge: true });
    }

    return res.status(200).json({
      biteshipStatus: data.status,
      waybill: data?.courier?.waybill_id || null,
      data
    });
  } catch (err) {
    console.error('retrieve-order error:', err);
    return res.status(500).json({ error: 'Internal retrieve error', detail: err.message });
  }
}