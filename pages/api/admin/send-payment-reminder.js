import { adminDb } from '@/utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// helper
function formatRupiah(number = 0) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { invoiceId } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

  try {
    const invRef = adminDb.collection('invoices').doc(invoiceId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invSnap.data();

    // find buyer email (fallback to users collection by buyerId)
    let buyerEmail = inv.buyerEmail || inv.email || (inv.buyer && inv.buyer.email) || null;
    let buyerName = inv.buyerName || (inv.buyer && inv.buyer.name) || '';

    if (!buyerEmail && inv.buyerId) {
      try {
        const userSnap = await adminDb.collection('users').doc(inv.buyerId).get();
        if (userSnap.exists) {
          const user = userSnap.data();
          buyerEmail = buyerEmail || user.email || user.emailAddress || null;
          buyerName = buyerName || user.name || user.displayName || '';
        }
      } catch (e) {
        console.warn('Failed lookup user for buyerId:', e.message || e);
      }
    }

    if (!buyerEmail) return res.status(422).json({ error: 'Buyer email not found' });

    const amount = inv.grandTotal || inv.grand_total || inv.total || 0;
    const subject = `Pengingat Pembayaran - Invoice ${invoiceId}`;
    const text = `Halo ${buyerName || ''},

Silakan melakukan pembayaran untuk Invoice ${invoiceId} sebesar ${formatRupiah(amount)}.

Terima kasih.`;
    const html = `<p>Halo ${buyerName || ''},</p>
<p>Silakan melakukan pembayaran untuk <strong>Invoice ${invoiceId}</strong> sebesar <strong>${formatRupiah(amount)}</strong>.</p>
<p>Terima kasih.</p>`;

    if (process.env.SENDGRID_API_KEY) {
      await sgMail.send({
        to: buyerEmail,
        from: process.env.EMAIL_FROM || 'no-reply@ikanhub-2b71c.firebaseapp.com',
        subject,
        text,
        html,
      });
    } else {
      console.log('EMAIL FALLBACK - send payment reminder:', { to: buyerEmail, subject, text });
    }

    // update invoice metadata
    const ts = FieldValue.serverTimestamp();
    const increment = FieldValue.increment ? FieldValue.increment(1) : 1;
    await invRef.update({
      paymentReminderSentAt: ts,
      paymentReminderCount: increment,
      updatedAt: ts,
    });

    return res.status(200).json({ ok: true, email: buyerEmail });
  } catch (err) {
    console.error('send-payment-reminder error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}