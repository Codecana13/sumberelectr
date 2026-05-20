import { adminDb } from '@/utils/firebaseAdmin';
import crypto from 'crypto';

// Map midtrans status to our invoice statuses
function mapStatus(s) {
  const st = String(s || '').toLowerCase();
  switch (st) {
    case 'capture':
    case 'settlement':
      return 'paid';
    case 'pending':
      return 'awaiting_payment';
    case 'deny':
    case 'cancel':
      return 'cancelled';
    case 'expire':
      return 'expired';
    default:
      return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const {
      order_id,
      transaction_status,
      status_code,
      gross_amount,
      payment_type,
      signature_key
    } = req.body || {};

    if (!order_id) return res.status(400).json({ error: 'order_id missing' });

    // Verify signature if provided
    try {
      const serverKey = process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY_SANDBOX;
      if (signature_key && serverKey) {
        const payload = `${order_id}${status_code}${gross_amount}${serverKey}`;
        const expected = crypto.createHash('sha512').update(payload).digest('hex');
        if (String(signature_key) !== String(expected)) {
          return res.status(403).json({ error: 'Invalid signature' });
        }
      }
    } catch (e) {
      // If verification fails unexpectedly, still proceed but log
      console.warn('Midtrans signature verification error:', e);
    }

    // Our order_id includes a unique suffix, derive base invoice id
    const baseId = String(order_id).split('-')[0];
    let invRef = adminDb.collection('invoices').doc(baseId);
    let invSnap = await invRef.get();
    if (!invSnap.exists) {
      // Fallback: search by midtrans.order_id
      const q = await adminDb.collection('invoices').where('midtrans.order_id', '==', order_id).limit(1).get();
      if (!q.empty) {
        invRef = q.docs[0].ref;
        invSnap = q.docs[0];
      } else {
        return res.status(404).json({ error: 'Invoice not found' });
      }
    }

    const mapped = mapStatus(transaction_status);
    const update = {
      paymentMethod: 'midtrans',
      'midtrans.last': req.body,
      updatedAt: new Date()
    };
    if (mapped) {
      update.status = mapped;
      if (mapped === 'paid') update.paidAt = new Date();
    }

    await invRef.update(update);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('midtrans/notifications error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
