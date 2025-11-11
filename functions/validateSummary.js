// Validation script for layout_summaries/latest
// Usage (from functions directory):
//   node validateSummary.js
// Exit code 0 = valid, 1 = invalid/error

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function resolveProjectId() {
  // Priority: CLI args --project=, env GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, FIREBASE_CONFIG.projectId, explicit PROJECT_ID
  const argProj = process.argv.find(a => a.startsWith('--project='))?.split('=')[1];
  if (argProj) return argProj;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.PROJECT_ID) return process.env.PROJECT_ID;
  if (process.env.FIREBASE_CONFIG) {
    try {
      const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
      if (cfg.projectId) return cfg.projectId;
    } catch (_) {}
  }
  return null;
}

(async () => {
  try {
    const projectId = resolveProjectId();
    if (!projectId) {
      console.error('Cannot determine projectId. Provide one of:');
      console.error('  node validateSummary.js --project=your-project-id');
      console.error('  PROJECT_ID=your-project-id node validateSummary.js');
      console.error('Or run inside Firebase emulator context (emulators set FIREBASE_CONFIG).');
      process.exit(1);
    }
    if (!admin.apps.length) {
      // Support --sa=serviceAccount.json for local validation without ADC
      const saArg = process.argv.find(a => a.startsWith('--sa='))?.split('=')[1];
      let credential = null;
      if (saArg) {
        try {
          const saPath = path.resolve(process.cwd(), saArg);
            const json = JSON.parse(fs.readFileSync(saPath, 'utf8'));
            credential = admin.credential.cert(json);
            console.log('[INFO] Using service account file', saPath);
        } catch (e) {
          console.error('[ERROR] Failed to load service account file:', e.message);
          process.exit(1);
        }
      } else if (process.env.SERVICE_ACCOUNT_JSON) {
        try {
          const json = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
          credential = admin.credential.cert(json);
          console.log('[INFO] Using SERVICE_ACCOUNT_JSON env variable');
        } catch (e) {
          console.error('[ERROR] Invalid SERVICE_ACCOUNT_JSON env value:', e.message);
          process.exit(1);
        }
      }
      if (credential) {
        admin.initializeApp({ credential, projectId });
      } else {
        // Falls back to ADC (GOOGLE_APPLICATION_CREDENTIALS or logged in gcloud / firebase-tools token)
        admin.initializeApp({ projectId });
      }
    }
    // Emulator hint
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      console.log('[INFO] Using Firestore emulator at', process.env.FIRESTORE_EMULATOR_HOST, 'project', projectId);
    } else {
      console.log('[INFO] Using Firestore project', projectId);
    }
    const db = admin.firestore();
    const doc = await db.collection('layout_summaries').doc('latest').get();
    if (!doc.exists) {
      console.error('Missing document: layout_summaries/latest');
      process.exit(1);
    }
    const data = doc.data() || {};

    const errors = [];
    function assert(cond, msg) { if (!cond) errors.push(msg); }
    const isArray = (v) => Array.isArray(v);

    assert(typeof data.date === 'string', 'date must be string');
    assert(isArray(data.favorites), 'favorites must be array');
    assert(isArray(data.recommendations), 'recommendations must be array');
    assert(isArray(data.ads), 'ads must be array');
    assert(isArray(data.favoritesSchema), 'favoritesSchema must be array');
    assert(isArray(data.recommendationsSchema), 'recommendationsSchema must be array');

    const prodShape = (p, idx, label) => {
      const prefix = `${label}[${idx}]`;
      assert(typeof p.id === 'string', `${prefix}.id missing`);
      assert(typeof p.name === 'string', `${prefix}.name missing`);
      assert('sizeVariants' in p, `${prefix}.sizeVariants missing`);
    };

    (data.favorites || []).slice(0,8).forEach((p,i)=>prodShape(p,i,'favorites'));
    (data.recommendations || []).slice(0,12).forEach((p,i)=>prodShape(p,i,'recommendations'));

    if (errors.length) {
      console.error('Validation FAILED:', errors);
      process.exit(1);
    }
    console.log('Summary validation OK:', {
      date: data.date,
      favorites: data.favorites.length,
      recommendations: data.recommendations.length,
      ads: data.ads.length,
      favoritesSchema: data.favoritesSchema.length,
      recommendationsSchema: data.recommendationsSchema.length
    });
    process.exit(0);
  } catch (e) {
    if (String(e && e.message).includes('Could not load the default credentials')) {
      console.error('Validation error: default credentials not found. Options:');
      console.error('  1) Provide a service account JSON:');
      console.error('     node validateSummary.js --project=YOUR_PROJECT --sa=./serviceAccount.json');
      console.error('  2) Set GOOGLE_APPLICATION_CREDENTIALS env var to a service account file path.');
      console.error('  3) Export SERVICE_ACCOUNT_JSON env with the raw JSON content.');
      console.error('  4) Run inside emulator environment (firebase emulators:start)');
    } else {
      console.error('Validation error:', e);
    }
    process.exit(1);
  }
})();
