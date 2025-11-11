import { adminDb } from '@/utils/firebaseAdmin';

function mapXenditStatus(s) {
  const S = (s || '').toUpperCase();
  if (S === 'PAID') return 'paid';
  if (S === 'EXPIRED') return 'expired';
  if (S === 'SETTLED') return 'paid';
  if (S === 'PENDING') return 'pending';
  if (S === 'FAILED' || S === 'CANCELLED' || S === 'CANCELED') return 'failed';
  return S.toLowerCase() || 'pending';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const receivedAt = new Date();
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k,v]) => [k, Array.isArray(v)?v.join(','):v]));

  // Verify callback token if provided
  const expectedToken = process.env.XENDIT_CALLBACK_TOKEN || process.env.XENDIT_WEBHOOK_TOKEN;
  const gotToken = headers['x-callback-token'] || headers['x-xendit-callback-token'];
  if (expectedToken && gotToken !== expectedToken) {
    // Log and reject
    try { await adminDb.collection('webhooks_logs').add({ source:'xendit', phase:'token_mismatch', createdAt:receivedAt, headers, body:req.body }); } catch {}
    return res.status(401).json({ error: 'Invalid callback token' });
  }

  // Parse payload
  const body = req.body || {};
  try {
    await adminDb.collection('webhooks_logs').add({ source: 'xendit', phase: 'received', createdAt: receivedAt, headers, body });
  } catch {}

  const externalId = body.external_id || body.merchant_external_id || body.reference_id;
  const xenditId = body.id || body.invoice_id;
  const statusRaw = body.status;
  const amount = Number(body.amount || 0);

  if (!externalId) {
    return res.status(400).json({ error: 'Missing external_id' });
  }

  const invoiceId = String(externalId);

  try {
    const ref = adminDb.collection('invoices').doc(invoiceId);
    const snap = await ref.get();

    if (!snap.exists) {
      await adminDb.collection('webhooks_logs').add({ source:'xendit', phase:'invoice_not_found', createdAt: new Date(), invoiceId, xenditId, body }).catch(()=>{});
      // Return 200 to avoid excessive retries
      return res.status(200).json({ received: true, invoiceFound: false });
    }

    const current = snap.data() || {};
    const mapped = mapXenditStatus(statusRaw);

    const existing = current.xendit || {};
    const currentStatus = existing.status || current.status || 'pending';

    // Idempotent: don't roll back a paid invoice
    if (currentStatus === 'paid' && mapped !== 'paid') {
      await ref.set({
        xendit: { ...existing, lastNotifyAt: new Date(), rawNotify: body },
        updatedAt: new Date()
      }, { merge: true });
      return res.status(200).json({ received: true, ignored: true, reason: 'already_paid' });
    }

    let newInvoiceStatus = current.status || 'waiting';
    if (mapped === 'paid' && ['waiting','draft','pending','awaiting_payment'].includes(newInvoiceStatus)) {
      newInvoiceStatus = 'paid';
    } else if (mapped === 'failed' && ['waiting','pending','awaiting_payment'].includes(newInvoiceStatus)) {
      newInvoiceStatus = 'cancelled';
    } else if (mapped === 'expired' && ['waiting','pending','awaiting_payment'].includes(newInvoiceStatus)) {
      newInvoiceStatus = 'expired';
    }

    const mismatch = (amount && current.grandTotal && Number(current.grandTotal) !== amount)
      ? { paidAmount: amount, expected: Number(current.grandTotal) } : null;

    await ref.set({
      status: newInvoiceStatus,
      updatedAt: new Date(),
      paymentReceivedAt: mapped === 'paid' ? (current.paymentReceivedAt || new Date()) : (current.paymentReceivedAt || null),
      xendit: {
        ...existing,
        id: xenditId || existing.id || null,
        status: mapped,
        lastNotifyAt: new Date(),
        rawNotify: body,
        ...(mismatch ? { mismatch } : {})
      }
    }, { merge: true });

    try {
      await adminDb.collection('webhooks_logs').add({ source:'xendit', phase:'updated_invoice', createdAt: new Date(), invoiceId, xenditId, mappedStatus: mapped });
    } catch {}

    return res.status(200).json({ received: true, invoiceId, xenditStatus: mapped, invoiceStatus: newInvoiceStatus, mismatch: mismatch || undefined });
  } catch (e) {
    console.error('Xendit webhook error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
