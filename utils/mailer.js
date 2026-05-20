import sgMail from '@sendgrid/mail';

const SENDGRID_KEY = process.env.SENDGRID_API_KEY || null;
if (SENDGRID_KEY) sgMail.setApiKey(SENDGRID_KEY);

function statusLabel(status) {
  if (!status) return status;
  const m = {
    confirmed: 'Terkonfirmasi',
    allocated: 'Sedang Dialokasikan',
    picked_up: 'Diambil Kurir',
    in_transit: 'Dalam Perjalanan',
    on_delivery: 'Dalam Pengantaran',
    delivered: 'Terkirim',
    cancelled: 'Dibatalkan'
  };
  return m[status] || status;
}

export async function sendDeliveryStatusEmail({ to, name, invoiceId, status, waybill, trackingLink }) {
  const label = statusLabel(status);
  const subject = `Update Pengiriman: Invoice #${invoiceId} — ${label}`;
  const text = `Halo ${name || ''},

Status pengiriman untuk Invoice #${invoiceId} berubah menjadi: ${label}.
Nomor resi: ${waybill || '-'}

${trackingLink ? `Lacak paket: ${trackingLink}` : ''}

Terima kasih.
`;
  const html = `<p>Halo ${name || ''},</p>
<p>Status pengiriman untuk <strong>Invoice #${invoiceId}</strong> berubah menjadi: <strong>${label}</strong>.</p>
<p>Nomor resi: <strong>${waybill || '-'}</strong></p>
${trackingLink ? `<p><a href="${trackingLink}" target="_blank">Lacak paket</a></p>` : ''}
<p>Terima kasih.</p>`;

  if (SENDGRID_KEY) {
    try {
      await sgMail.send({
        to,
        from: process.env.EMAIL_FROM || 'no-reply@yourdomain.com',
        subject,
        text,
        html
      });
      return { ok: true };
    } catch (err) {
      console.error('sendDeliveryStatusEmail sendgrid error:', err?.message || err);
      return { ok: false, error: err };
    }
  } else {
    // fallback: log only (safe for dev)
    console.log('EMAIL FALLBACK:', { to, subject, text });
    return { ok: true, fallback: true };
  }
}