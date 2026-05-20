import { adminDb } from '@/utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req,res){
  if (req.method !== 'GET') return res.status(405).json({error:'GET only'});
  try {
    const snap = await adminDb.collection('invoices').limit(500).get();
    const missing = [];
    const batch = adminDb.batch();
    snap.forEach(doc=>{
      const d = doc.data();
      if (!d.buyerId) {
        // coba tebak dari nested buyer object
        const guessed = d.buyerId || d.buyer?.id || d.buyer?.uid || null;
        missing.push({id: doc.id, guessed});
        if (guessed) {
          batch.update(doc.ref, { buyerId: guessed, updatedAt: FieldValue.serverTimestamp() });
        }
      }
    });
    if (missing.length) await batch.commit();
    return res.status(200).json({ checked: snap.size, fixed: missing.filter(m=>m.guessed).length, missing });
  } catch(e){
    console.error(e);
    return res.status(500).json({error:e.message});
  }
}