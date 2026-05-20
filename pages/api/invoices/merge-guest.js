import { adminDb } from '@/utils/firebaseAdmin';

/**
 * Merge guest invoices (identified by guestSessionId OR guestUid) into a logged-in user account.
 * POST body: { userUid: string, guestSessionId?: string, guestUid?: string, dryRun?: boolean }
 * Security NOTE: In production, validate Firebase ID token and derive userUid from auth context.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { userUid, guestSessionId, guestUid, dryRun = false } = req.body || {};
  if (!userUid) return res.status(400).json({ error: 'userUid required' });
  if (!guestSessionId && !guestUid) return res.status(400).json({ error: 'guestSessionId or guestUid required' });

  try {
    // Build query conditions
    let query = adminDb.collection('invoices');
    if (guestSessionId) {
      query = query.where('guestSessionId', '==', String(guestSessionId));
    } else if (guestUid) {
      query = query.where('guestUid', '==', String(guestUid));
    }
    const snap = await query.get();
    if (snap.empty) {
      return res.status(200).json({ ok: true, mergedCount: 0, dryRun, invoices: [] });
    }
    const invoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (dryRun) {
      return res.status(200).json({ ok: true, mergedCount: 0, dryRun: true, invoices });
    }

    const batch = adminDb.batch();
    invoices.forEach(inv => {
      const ref = adminDb.collection('invoices').doc(inv.invoiceId || inv.id);
      batch.update(ref, {
        buyerId: userUid,
        buyerType: 'member',
        mergeStatus: 'merged',
        mergedFromGuest: true,
        mergedAt: new Date(),
        guestUid: null,
        guestSessionId: null,
      });
    });
    await batch.commit();

    // Update guest session doc if provided
    if (guestSessionId) {
      await adminDb.collection('guest_sessions').doc(String(guestSessionId)).set({
        mergeStatus: 'merged',
        mergedAt: new Date(),
        memberUid: userUid,
      }, { merge: true });
    }

    return res.status(200).json({ ok: true, mergedCount: invoices.length });
  } catch (e) {
    console.error('merge-guest error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}