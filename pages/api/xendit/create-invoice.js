import { adminDb } from '@/utils/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || process.env.XENDIT_API_KEY;
  if (!XENDIT_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing Xendit secret key' });
  }

  try {
    const {
      invoiceId,
      amount,
      payer_email,
      payer_name,
      payer_phone,
      description,
      success_url,
      failure_url,
    } = req.body || {};

    if (!invoiceId || !amount) {
      return res.status(400).json({ error: 'invoiceId and amount are required' });
    }

    // Use REST API directly to avoid SDK compatibility issues
    const auth = Buffer.from(`${XENDIT_SECRET_KEY}:`).toString('base64');
    const payload = {
      external_id: String(invoiceId),
      amount: Math.max(1, Math.round(Number(amount))),
      currency: 'IDR',
      description: description || `Invoice ${invoiceId}`,
      payer_email: payer_email || undefined,
      customer: (payer_name || payer_email || payer_phone) ? {
        given_names: payer_name || undefined,
        email: payer_email || undefined,
        mobile_number: payer_phone || undefined,
      } : undefined,
      success_redirect_url: success_url || undefined,
      failure_redirect_url: failure_url || undefined,
      invoice_duration: 86400,
    };

    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let created;
    try { created = JSON.parse(text); } catch { created = null; }

    if (!response.ok) {
      // Log detailed HTTP error for debugging 403/400
      await adminDb.collection('webhooks_logs').add({
        source: 'xendit', phase: 'create_invoice_http_error', createdAt: new Date(), invoiceId, status: response.status, body: created || text
      }).catch(()=>{});
      return res.status(response.status).json(created || { error: text });
    }

    const { id, invoice_url, status, amount: amt } = created || {};
    const resolvedUrl = invoice_url || created?.url || null;

    // Persist minimal Xendit info to Firestore (best-effort)
    try {
      const ref = adminDb.collection('invoices').doc(String(invoiceId));
      await ref.set({
        paymentMethod: 'xendit',
        updatedAt: new Date(),
        xendit: {
          id: id || null,
          invoiceUrl: resolvedUrl || null,
          status: status || 'PENDING',
          amount: amt || Math.round(Number(amount)),
          rawCreate: created,
          lastCreateAt: new Date(),
        }
      }, { merge: true });
    } catch (e) {
      // Log but don’t fail the API response
      await adminDb.collection('webhooks_logs').add({
        source: 'xendit', phase: 'create_invoice_persist_error', createdAt: new Date(), invoiceId, error: String(e)
      }).catch(()=>{});
    }

    return res.status(200).json({
      id,
      invoice_url: resolvedUrl,
      status,
      amount: amt || Math.round(Number(amount)),
      raw: created,
    });
  } catch (e) {
    console.error('Xendit create-invoice error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
