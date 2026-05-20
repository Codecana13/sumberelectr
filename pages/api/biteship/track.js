import axios from 'axios';
import { adminDb } from '@/utils/firebaseAdmin';

// Helper ambil invoice
async function getInvoice(invoiceId) {
  if (!invoiceId) return null;
  const snap = await adminDb.collection('invoices').doc(String(invoiceId)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// Mapping status biteship -> status invoice
const MAP_FINAL = {
  delivered: 'completed',
  completed: 'completed', // <-- tambah
  returned: 'returned',
  cancelled: 'cancelled',
  rejected: 'cancelled',
  couriernotfound: 'cancelled',
  disposed: 'cancelled'
};
const FINAL_SET = new Set(Object.keys(MAP_FINAL));

// Public tracking endpoint (requires waybill + courier)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { waybill, courier, invoiceId } = req.query;
  const apiKey = process.env.BITESHIP_API_KEY || process.env.NEXT_PUBLIC_BITESHIP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing Biteship API key' });

  try {
    let wb = waybill;
    let cc = courier;
    let inv = null;

    // Ambil invoice jika perlu
    if (invoiceId) {
      inv = await getInvoice(invoiceId);
      if (!wb) {
        wb =
          inv?.waybillId ||
          inv?.biteshipRaw?.courier?.waybill_id ||
          inv?.codOrderId ||
          null;
      }
      if (!cc) {
        cc =
          inv?.shippingSelection?.courier ||
          inv?.biteshipRaw?.courier?.company ||
          null;
      }
    }

    if (!wb || !cc) {
      return res.status(400).json({ error: 'Missing waybill or courier' });
    }

    // Panggil API Biteship tracking
    const url = `https://api.biteship.com/v1/trackings/${encodeURIComponent(wb)}/couriers/${encodeURIComponent(cc)}`;
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    // Baca JSON (Biteship selalu kembalikan objek)
    const data = await upstream.json();

    if (upstream.status === 404 || data?.code === 40003003) {
      return res.status(404).json({ error: 'Tracking not found', detail: data });
    }
    if (!upstream.ok || data.success === false) {
      return res.status(upstream.status || 500).json({
        error: data.error || 'Failed to get tracking',
        detail: data
      });
    }

    // Data tracking (Biteship model)
    const tracking = data.object === 'tracking' ? data : data.tracking || data;
    const biteshipStatus = (tracking.status || '').toLowerCase();

    // Update invoice (hanya kalau invoiceId ada)
    if (invoiceId && inv) {
      const update = {
        biteshipStatus: tracking.status || null,
        trackingUpdatedAt: new Date(),
        waybillId: tracking.waybill_id || wb,
        trackingCourier: cc,
        trackingPublicRaw: tracking
      };

      // Jika status final & status invoice belum di-set sesuai
      if (FINAL_SET.has(biteshipStatus)) {
        const mapped = MAP_FINAL[biteshipStatus];
        if (mapped && inv.status !== mapped) {
          update.status = mapped;
          if (mapped === 'completed') update.completedAt = new Date();
        }
      }

      // Simpan hanya jika ada perubahan signifikan
      await adminDb.collection('invoices').doc(inv.id).set(update, { merge: true });
    }

    return res.status(200).json({ tracking });
  } catch (e) {
    console.error('track-api error', e);
    return res.status(500).json({ error: 'Internal error tracking', detail: e.message });
  }
}