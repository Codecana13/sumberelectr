import { adminDb } from '@/utils/firebaseAdmin';
import { generateInvoiceId } from '@/utils/invoice';
import { FieldValue } from 'firebase-admin/firestore';
// Enhancement: support guestSessionId and persist guest session document for future merge

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      invoiceId,
      buyerName,
      buyerEmail,
      buyerPhone,
      shippingAddress,
      items,
      gateway = 'xendit',
      guestUid,           // anonymous uid or temporary guest uid from client
      guestSessionId,     // new: stable session token (uuid) stored in localStorage/cookie
    } = req.body || {};

    // Basic validation
    if (!buyerName || !buyerPhone) {
      return res.status(400).json({ error: 'buyerName and buyerPhone are required' });
    }
    // Normalize shippingAddress from either minimal client payload or full Biteship area
    const sa = shippingAddress || {};
    const areaObj = sa.area || {};
    
    // PENTING: Biteship butuh area_id dengan format lengkap (id + "IDZ" + postal_code)
    let fullAreaId = sa.area_id || areaObj.id || '';
    const postalCode = sa.postal_code || areaObj.postal_code || '';
    
    // Jika area_id belum include postal code (tidak ada "IDZ"), tambahkan
    if (fullAreaId && postalCode && !fullAreaId.includes('IDZ')) {
      fullAreaId = fullAreaId + 'IDZ' + postalCode;
    }
    
    const normalizedShipping = {
      receiver_name: sa.receiver_name || buyerName || '',
      phone: sa.phone || buyerPhone || '',
      email: sa.email || buyerEmail || '',
      address: sa.address || [sa.street, sa.district || areaObj.name, sa.city || sa.city_name || areaObj.city_name, sa.province || areaObj.province].filter(Boolean).join(', ') + (postalCode ? ` ${postalCode}` : ''),
      district: sa.district || areaObj.name || '',
      city: sa.city || sa.city_name || areaObj.city_name || '',
      province: sa.province || areaObj.province || '',
      postal_code: postalCode,
      area_id: fullAreaId,
      area: Object.keys(areaObj).length ? areaObj : undefined,
      notes: sa.notes ?? null,
    };
    if (!normalizedShipping.area_id) {
      return res.status(400).json({ error: 'shippingAddress.area_id is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }

    // Compute totals server-side
    const safeItems = items.map((it) => ({
      productId: String(it.productId || ''),
      name: String(it.name || ''),
      variant: it.variant || it.variantLabel || null,
      variantLabel: it.variantLabel || it.variant || null,
      variantSize: typeof it.variantSize === 'number' ? it.variantSize : null,
      price: Number(it.price) || 0,
      retailPrice: Number(it.retailPrice || it.price || 0) || 0,
      priceMode: it.priceMode || 'retail',
      quantity: Math.max(1, Number(it.quantity) || 1),
      weight: Math.max(0, Number(it.weight) || 0),
    }));

    const subtotal = safeItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalWeight = safeItems.reduce((s, i) => s + i.weight * i.quantity, 0);
    const totalQuantity = safeItems.reduce((s, i) => s + i.quantity, 0);

    // Choose invoice ID: prefer client-provided, else generate
  const id = String(invoiceId || generateInvoiceId());

    const now = new Date();
  // Fallback guest UID generation if anonymous auth not available
  const effectiveGuestUid = guestUid ? String(guestUid) : ('g_' + Math.random().toString(36).slice(2,9));
  const buyerId = guestUid ? String(guestUid) : null; // keep buyerId null so client fetch fallback works
    const data = {
      invoiceId: id,
      cartId: 'guest',
      buyerId,                  // for existing UI paths
  guestUid: effectiveGuestUid, // explicit guest reference (random fallback if auth not provided)
      guestSessionId: guestSessionId ? String(guestSessionId) : null,
      buyerType: 'guest',
      mergeStatus: 'guest',     // later becomes 'merged' after account claim
      buyerName: String(buyerName).trim(),
      buyerEmail: (buyerEmail || '').trim(),
      buyerPhone: String(buyerPhone).trim(),
      // Back-compat fields for UI and downstream code paths
      buyerAddress: String(normalizedShipping.address || ''),
      destinationAddress: String(normalizedShipping.address || ''),
      shippingAddress: normalizedShipping,
      destinationAreaId: normalizedShipping.area_id,
      items: safeItems.map(i => ({ ...i, subtotal: i.price * i.quantity })),
      subtotal,
      totalWeight,
      totalQuantity,
      voucher: null,
      voucherDiscount: 0,
      shippingCost: 0,
      grandTotal: subtotal,
      status: 'draft',
      payment: { gateway: gateway || 'xendit', status: 'not_initiated' },
      createdAt: now,
      updatedAt: now,
    };

    // Optional: upsert minimal guest user profile so UI can show consistent info
    if (buyerId) {
      const userRef = adminDb.collection('users').doc(buyerId);
      await userRef.set({
        uid: buyerId,
        name: String(buyerName).trim(),
        email: (buyerEmail || '').trim(),
        phone: String(buyerPhone).trim(),
        address: (shippingAddress && shippingAddress.address) ? String(shippingAddress.address) : '',
        address_province: shippingAddress?.province || shippingAddress?.area?.province || '',
        address_city: shippingAddress?.city || shippingAddress?.area?.city_name || '',
        address_district: shippingAddress?.district || shippingAddress?.area?.name || '',
        postal_code: shippingAddress?.postal_code || shippingAddress?.area?.postal_code || '',
        area_id: shippingAddress?.area_id || shippingAddress?.area?.id || '',
        role: 'guest',
        updatedAt: now,
        createdAt: now
      }, { merge: true });
    }

    await adminDb.collection('invoices').doc(id).set(data, { merge: false });

    // Persist / upsert guest session document for future merging when user registers/logs in.
    if (data.guestSessionId) {
      const gsRef = adminDb.collection('guest_sessions').doc(data.guestSessionId);
      await gsRef.set({
        sessionId: data.guestSessionId,
        anonymousUid: data.guestUid || null,
        invoices: FieldValue.arrayUnion(id),
        lastInvoiceId: id,
        lastUpdatedAt: now,
        createdAt: now,
        mergeStatus: 'pending',
        buyerEmail: data.buyerEmail || null,
        buyerPhone: data.buyerPhone || null,
      }, { merge: true });
    }

  return res.status(200).json({ ok: true, invoiceId: id, guestSessionId: data.guestSessionId });
  } catch (e) {
    console.error('create-guest invoice error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
