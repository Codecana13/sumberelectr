// Refactor import: use firebase-admin Firestore directly (previous default import could be invalid)
import { adminApp } from '@/utils/firebaseAdmin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const adminDb = getFirestore(adminApp);

/**
 * API untuk update shipping selection di invoice
 * Digunakan oleh guest user yang tidak punya permission client-side
 * 
 * POST /api/invoices/update-shipping
 * Body: {
 *   invoiceId: string,
 *   guestUid: string (optional, untuk verify ownership),
 *   shippingSelection: object,
 *   shippingCost: number,
 *   grandTotal: number,
 *   status: string (optional)
 * }
 */
export default async function handler(req, res) {
  console.log('[update-shipping] Request received:', {
    method: req.method,
    body: req.body,
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      invoiceId,
      guestUid,
      shippingSelection,
      shippingCost,
      grandTotal,
      status,
    } = req.body;

    if (!invoiceId || !shippingSelection || shippingCost === undefined || grandTotal === undefined) {
      console.error('[update-shipping] Missing fields:', {
        hasInvoiceId: !!invoiceId,
        hasShippingSelection: !!shippingSelection,
        hasShippingCost: shippingCost !== undefined,
        hasGrandTotal: grandTotal !== undefined,
      });
      return res.status(400).json({
        error: 'Missing required fields: invoiceId, shippingSelection, shippingCost, grandTotal',
      });
    }

  const invoiceRef = adminDb.collection('invoices').doc(String(invoiceId));
    
    console.log('[update-shipping] Fetching invoice:', invoiceId);
    console.log('[update-shipping] Fetching invoice:', invoiceId);
  const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      console.error('[update-shipping] Invoice not found:', invoiceId);
      return res.status(404).json({ error: 'Invoice not found' });
    }

  const invoiceData = invoiceSnap.data();
    console.log('[update-shipping] Invoice found:', {
      hasGuestUid: !!invoiceData.guestUid,
      guestUidMatch: invoiceData.guestUid === guestUid,
    });

    // Verify ownership jika guest
  if (guestUid && invoiceData.guestUid && invoiceData.guestUid !== guestUid) {
      console.error('[update-shipping] Ownership mismatch:', {
        expected: invoiceData.guestUid,
        provided: guestUid,
      });
      return res.status(403).json({ error: 'Not authorized to update this invoice' });
    }

    // Update invoice
    const updateData = {
      shippingSelection,
      shippingCost,
      grandTotal,
      updatedAt: FieldValue.serverTimestamp(),
      // Reset Xendit link if any, buyer must recreate payment with new total
      'xendit.invoiceUrl': null,
    };

    // Update status jika disediakan
    if (status) {
      updateData.status = status;
    }

    console.log('[update-shipping] Updating invoice with:', updateData);
  await invoiceRef.update(updateData);
    
    console.log('[update-shipping] Update successful!');
    return res.status(200).json({
      success: true,
      message: 'Shipping updated successfully',
    });
  } catch (error) {
    console.error('[update-shipping] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}
