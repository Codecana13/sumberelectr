import { adminDb } from '@/utils/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

async function requireAdmin(req, res) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return null;
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const decoded = await requireAdmin(req, res);
    if (!decoded?.uid) return res.status(401).json({ error: 'Unauthorized' });

    // Optional: check role flag from Firestore users collection
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const isAdmin = userSnap.exists && (userSnap.data().role === 'admin' || userSnap.data().isAdmin === true);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { action, number, rotationIndex } = req.body || {};
    const ref = adminDb.collection('settings').doc('whatsapp');
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    let numbers = Array.isArray(data.numbers) ? data.numbers : [];
    let idx = Number.isInteger(data.rotationIndex) ? data.rotationIndex : 0;

    if (action === 'add') {
      if (!number) return res.status(400).json({ error: 'number required' });
      if (!numbers.includes(number)) numbers = [...numbers, number];
      await ref.set({ numbers }, { merge: true });
    } else if (action === 'remove') {
      if (!number) return res.status(400).json({ error: 'number required' });
      numbers = numbers.filter(n => n !== number);
      if (idx >= numbers.length) idx = 0;
      await ref.set({ numbers, rotationIndex: idx }, { merge: true });
    } else if (action === 'setRotation') {
      const n = Number(rotationIndex);
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: 'invalid rotationIndex' });
      idx = numbers.length ? Math.min(n, numbers.length - 1) : 0;
      await ref.set({ rotationIndex: idx }, { merge: true });
    } else if (action === 'advance') {
      idx = numbers.length ? (idx + 1) % numbers.length : 0;
      await ref.set({ rotationIndex: idx }, { merge: true });
    } else {
      return res.status(400).json({ error: 'invalid action' });
    }

    const outSnap = await ref.get();
    const out = outSnap.exists ? outSnap.data() : { numbers: [], rotationIndex: 0 };
    return res.status(200).json({ numbers: out.numbers || [], rotationIndex: out.rotationIndex || 0 });
  } catch (e) {
    console.error('wa-settings error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
