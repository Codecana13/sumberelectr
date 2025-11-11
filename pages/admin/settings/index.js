import { useState, useEffect, useCallback, useRef } from 'react';
import { useStorage } from '@/hooks/useStorage';
import {
  doc as fsDoc,
  getDoc as fsGetDoc,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc
} from 'firebase/firestore';
import AdminLayout from '../_layout';
import { firestore, auth } from '@/utils/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import Image from 'next/image';

export default function AdminSettingsPage() {
  // Telegram chat ID admin management
  const [chatIds, setChatIds] = useState([]);
  const [newChatId, setNewChatId] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatOk, setChatOk] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [imgUploading, setImgUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { uploadFile } = useStorage();
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState([]);
  const [catEdits, setCatEdits] = useState({}); // temp edits per cat id
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [isAdmin, setIsAdmin] = useState(null); // null=loading, false=no
  // WhatsApp admin numbers rotation
  const [waNumbers, setWaNumbers] = useState([]); // array nomor
  const [newWaNumber, setNewWaNumber] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState('');
  const [waOk, setWaOk] = useState('');
  const [rotationIndex, setRotationIndex] = useState(0); // index aktif sekarang

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setIsAdmin(false);
        return;
      }
      try {
        const userSnap = await getDoc(doc(firestore, 'users', u.uid));
        if (userSnap.exists()) {
          const d = userSnap.data();
          setIsAdmin(d.role === 'admin' || d.isAdmin === true);
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Load Telegram chatIds
  useEffect(() => {
    if (isAdmin !== true) return;
    setChatLoading(true);
    fsGetDoc(fsDoc(firestore, 'settings', 'telegram')).then(snap => {
      const arr = Array.isArray(snap.data()?.chatIds) ? snap.data().chatIds : [];
      setChatIds(arr);
    }).catch(() => setChatIds([])).finally(() => setChatLoading(false));
  }, [isAdmin]);

  // Load WhatsApp numbers & rotation state
  useEffect(() => {
    if (isAdmin !== true) return;
    setWaLoading(true);
    fsGetDoc(fsDoc(firestore, 'settings', 'whatsapp')).then(snap => {
      const data = snap.data() || {};
      const nums = Array.isArray(data.numbers) ? data.numbers : [];
      setWaNumbers(nums);
      setRotationIndex(Number.isInteger(data.rotationIndex) && data.rotationIndex < nums.length ? data.rotationIndex : 0);
    }).catch(() => {
      setWaNumbers([]);
      setRotationIndex(0);
    }).finally(() => setWaLoading(false));
  }, [isAdmin]);

  // Add chatId
  const handleAddChatId = async (e) => {
    e.preventDefault();
    setChatError('');
    setChatOk('');
    const id = newChatId.trim();
    if (!id) {
      setChatError('Chat ID wajib diisi.');
      return;
    }
    if (chatIds.includes(id)) {
      setChatError('Chat ID sudah ada.');
      return;
    }
    setChatLoading(true);
    try {
      const next = [...chatIds, id];
      await fsSetDoc(fsDoc(firestore, 'settings', 'telegram'), { chatIds: next }, { merge: true });
      setChatIds(next);
      setNewChatId('');
      setChatOk('Chat ID ditambah.');
    } catch (err) {
      setChatError(err.message || 'Gagal menambah Chat ID.');
    } finally {
      setChatLoading(false);
      setTimeout(() => setChatOk(''), 2000);
    }
  };

  // Add WhatsApp number
  const handleAddWaNumber = async (e) => {
    e.preventDefault();
    setWaError(''); setWaOk('');
    const raw = newWaNumber.trim();
    if (!raw) { setWaError('Nomor WA wajib.'); return; }
    let cleaned = raw.replace(/[^0-9]/g,'');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
    if (!/^62[0-9]{6,15}$/.test(cleaned)) { setWaError('Format nomor WA tidak valid (contoh: 6281234567890).'); return; }
    if (waNumbers.includes(cleaned)) { setWaError('Nomor sudah ada.'); return; }
    setWaLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken?.();
      const r = await fetch('/api/admin/wa-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'add', number: cleaned })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Gagal menambah nomor WA.');
      setWaNumbers(data.numbers || []);
      setRotationIndex(data.rotationIndex || 0);
      setNewWaNumber('');
      setWaOk('Nomor WA ditambah.');
    } catch (err) {
      setWaError(err.message || 'Gagal menambah nomor WA.');
    } finally {
      setWaLoading(false);
      setTimeout(() => setWaOk(''), 2000);
    }
  };

  // Remove WhatsApp number
  const handleRemoveWaNumber = async (num) => {
    if (!confirm('Hapus nomor WA ini?')) return;
    setWaLoading(true); setWaError(''); setWaOk('');
    try {
      const token = await auth.currentUser?.getIdToken?.();
      const r = await fetch('/api/admin/wa-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'remove', number: num })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Gagal hapus nomor WA.');
      setWaNumbers(data.numbers || []);
      setRotationIndex(data.rotationIndex || 0);
      setWaOk('Nomor WA dihapus.');
    } catch (e) {
      setWaError(e.message || 'Gagal hapus nomor WA.');
    } finally {
      setWaLoading(false);
      setTimeout(() => setWaOk(''), 2000);
    }
  };

  // Save rotation index manually
  const handleSaveRotation = async () => {
    setWaLoading(true); setWaError(''); setWaOk('');
    try {
      let idx = rotationIndex;
      if (idx < 0 || idx >= waNumbers.length) idx = 0;
      const token = await auth.currentUser?.getIdToken?.();
      const r = await fetch('/api/admin/wa-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'setRotation', rotationIndex: idx })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Gagal menyimpan rotasi.');
      setRotationIndex(data.rotationIndex || idx);
      setWaOk('Rotasi disimpan.');
    } catch (e) {
      setWaError(e.message || 'Gagal menyimpan rotasi.');
    } finally {
      setWaLoading(false); setTimeout(() => setWaOk(''), 2000);
    }
  };

  // Advance rotation (dipakai jika ingin gilir manual sekarang)
  const handleAdvanceRotation = async () => {
    if (!waNumbers.length) return;
    setWaLoading(true); setWaError(''); setWaOk('');
    try {
      const token = await auth.currentUser?.getIdToken?.();
      const r = await fetch('/api/admin/wa-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'advance' })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Gagal menggilir nomor.');
      setRotationIndex(data.rotationIndex || rotationIndex);
      setWaNumbers(data.numbers || waNumbers);
      setWaOk('Rotasi digeser ke nomor berikutnya.');
    } catch (e) {
      setWaError(e.message || 'Gagal menggilir nomor.');
    } finally {
      setWaLoading(false); setTimeout(() => setWaOk(''), 2000);
    }
  };

  // Remove chatId
  const handleRemoveChatId = async (id) => {
    if (!window.confirm('Hapus Chat ID ini?')) return;
    setChatLoading(true);
    setChatError('');
    setChatOk('');
    try {
      const next = chatIds.filter(x => x !== id);
      await fsSetDoc(fsDoc(firestore, 'settings', 'telegram'), { chatIds: next }, { merge: true });
      setChatIds(next);
      setChatOk('Chat ID dihapus.');
    } catch (err) {
      setChatError(err.message || 'Gagal hapus Chat ID.');
    } finally {
      setChatLoading(false);
      setTimeout(() => setChatOk(''), 2000);
    }
  };

  // Load categories realtime (hanya jika admin)
  useEffect(() => {
    if (isAdmin !== true) return;
    const qCat = query(collection(firestore, 'categories'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qCat, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setCats(list);
      // reset edits when list changes (preserve existing edits if same id)
      setCatEdits(prev => {
        const next = {};
        list.forEach(cat => {
          next[cat.id] = prev[cat.id] || {
            discountPercent: cat.discountPercent ?? '',
            discountActive: cat.discountActive ?? false,
            discountStart: toLocalInputValue(cat.discountStart),
            discountEnd: toLocalInputValue(cat.discountEnd)
          };
        });
        return next;
      });
    }, () => setCats([]));
    return () => unsub && unsub();
  }, [isAdmin]);

  const toSlug = (str) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Tidak punya izin.');
      return;
    }
    setError('');
    setOk('');
    const n = name.trim();
    if (!n) {
      setError('Nama kategori wajib.');
      return;
    }
    const slug = toSlug(n);
    setLoading(true);
    try {
      // Cek duplikat
      const qDup = query(
        collection(firestore, 'categories'),
        where('slug', '==', slug)
      );
      const dupSnap = await getDocs(qDup);
      if (!dupSnap.empty) {
        setError('Kategori sudah ada.');
        setLoading(false);
        return;
      }
      await addDoc(collection(firestore, 'categories'), {
        name: n,
        slug,
        icon: icon.trim() || '',
        active: true,
        createdAt: serverTimestamp()
      });
      setOk('Kategori ditambah.');
      setName('');
      setIcon('');
    } catch (err) {
      setError(err.message || 'Gagal menambah.');
    } finally {
      setLoading(false);
      setTimeout(() => setOk(''), 2500);
    }
  };

  // Firebase Storage upload (replacing Cloudinary request)
  const handleChooseFile = () => {
    fileInputRef.current?.click?.();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImgUploading(true);
      const folder = 'categories';
      const fileNameSlug = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-');
      const now = Date.now();
      const path = `${folder}/${now}-${fileNameSlug}`;
      const downloadUrl = await uploadFile(file, path);
      if (downloadUrl) setIcon(downloadUrl);
    } catch (err) {
      alert(err.message || 'Upload gagal');
    } finally {
      setImgUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = useCallback(async (cat) => {
    if (!cat?.id) return;
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;
    try {
      await deleteDoc(doc(firestore, 'categories', cat.id));
    } catch (e) {
      alert('Gagal hapus.');
    }
  }, []);

  // Helpers for datetime-local value conversion
  function toLocalInputValue(v) {
    try {
      let dt = null;
      if (v?.toDate?.()) dt = v.toDate();
      else if (typeof v === 'number') dt = new Date(v);
      else if (typeof v === 'string') dt = new Date(v);
      if (!dt || isNaN(dt.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      const yyyy = dt.getFullYear();
      const mm = pad(dt.getMonth() + 1);
      const dd = pad(dt.getDate());
      const hh = pad(dt.getHours());
      const mi = pad(dt.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    } catch { return ''; }
  }

  function fromLocalInputValue(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  const setEdit = (id, key, value) => {
    setCatEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [key]: value }
    }));
  };

  const saveCategoryDiscount = async (cat) => {
    if (!cat?.id) return;
    const ed = catEdits[cat.id] || {};
    const percent = Number(ed.discountPercent);
    if (isNaN(percent) || percent < 0 || percent > 90) {
      alert('Diskon harus 0..90');
      return;
    }
    const payload = {
      discountPercent: percent || 0,
      discountActive: !!ed.discountActive,
      discountStart: fromLocalInputValue(ed.discountStart) || null,
      discountEnd: fromLocalInputValue(ed.discountEnd) || null,
      updatedAt: serverTimestamp()
    };
    try {
      await fsUpdateDoc(fsDoc(firestore, 'categories', cat.id), payload);
      setOk(`Diskon kategori "${cat.name}" disimpan.`);
      setTimeout(() => setOk(''), 2000);
    } catch (e) {
      alert(e.message || 'Gagal menyimpan diskon kategori.');
    }
  };

  if (isAdmin === null) {
    return <AdminLayout><div className="p-6 text-sm text-gray-500">Memuat...</div></AdminLayout>;
  }
  if (!isAdmin) {
    return <AdminLayout><div className="p-6 text-sm text-red-600">Akses ditolak.</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto mb-8">
        <h1 className="text-xl font-semibold text-gray-800 mb-4">Pengaturan (Kategori & Telegram Admin)</h1>

        {/* Telegram Chat ID Admin Section */}
        <div className="mb-8 p-4 bg-white border rounded-lg shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Telegram Admin Chat IDs</h2>
          <form onSubmit={handleAddChatId} className="flex gap-2 mb-2">
            <input
              value={newChatId}
              onChange={e => setNewChatId(e.target.value)}
              className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Masukkan Chat ID Telegram"
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={chatLoading || !newChatId.trim()}
              className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
            >Tambah</button>
          </form>
          {chatError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded mb-2">{chatError}</div>
          )}
          {chatOk && (
            <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded mb-2">{chatOk}</div>
          )}
          <div className="mt-2">
            {chatLoading ? (
              <div className="text-xs text-gray-500">Memuat...</div>
            ) : chatIds.length === 0 ? (
              <div className="text-xs text-gray-500">Belum ada Chat ID admin.</div>
            ) : (
              <ul className="space-y-2">
                {chatIds.map((id, idx) => (
                  <li key={id} className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-gray-50 border px-2 py-1 rounded">{id}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChatId(id)}
                      className="px-2 py-1 text-[10px] rounded bg-red-50 text-red-600 hover:bg-red-100"
                      disabled={chatLoading}
                    >Hapus</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* WhatsApp Admin Numbers Section */}
        <div className="mb-8 p-4 bg-white border rounded-lg shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Nomor WhatsApp Admin (Rotasi)</h2>
          <form onSubmit={handleAddWaNumber} className="flex gap-2 mb-2">
            <input
              value={newWaNumber}
              onChange={e => setNewWaNumber(e.target.value)}
              className="px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Contoh: 62812xxxxxxx"
              disabled={waLoading}
            />
            <button
              type="submit"
              disabled={waLoading || !newWaNumber.trim()}
              className="px-4 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >Tambah</button>
          </form>
          {waError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded mb-2">{waError}</div>}
          {waOk && <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded mb-2">{waOk}</div>}
          <div className="mt-2">
            {waLoading ? (
              <div className="text-xs text-gray-500">Memuat...</div>
            ) : waNumbers.length === 0 ? (
              <div className="text-xs text-gray-500">Belum ada nomor WA.</div>
            ) : (
              <ul className="space-y-2">
                {waNumbers.map((num, idx) => (
                  <li key={num} className="flex items-center gap-2">
                    <span className={`text-xs font-mono border px-2 py-1 rounded ${idx===rotationIndex? 'bg-green-100 border-green-400 text-green-700':'bg-gray-50 border-gray-300 text-gray-700'}`}>{num}{idx===0 && ' (Utama)'}{idx===rotationIndex && ' • Aktif'}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWaNumber(num)}
                      className="px-2 py-1 text-[10px] rounded bg-red-50 text-red-600 hover:bg-red-100"
                      disabled={waLoading}
                    >Hapus</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {waNumbers.length > 1 && (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Index Aktif:</label>
                <input
                  type="number"
                  min={0}
                  max={waNumbers.length-1}
                  value={rotationIndex}
                  onChange={e => setRotationIndex(Math.min(Math.max(0, Number(e.target.value)||0), waNumbers.length-1))}
                  className="w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveRotation}
                  disabled={waLoading}
                  className="px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >Simpan Rotasi</button>
                <button
                  type="button"
                  onClick={handleAdvanceRotation}
                  disabled={waLoading}
                  className="px-3 py-2 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 border"
                >Gilir Berikutnya</button>
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">Nomor pertama dianggap <strong>utama</strong>. Tombol gilir akan memutar index aktif sehingga fitur frontend bisa memilih nomor WA yang berbeda agar beban CS tersebar.</p>
        </div>

        {/* Existing Category Section */}
        <form
            onSubmit={handleSubmit}
            className="p-4 bg-white border rounded-lg shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nama Kategori
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Contoh: Aquascape Tools"
              maxLength={60}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              URL Icon (opsional)
            </label>
            <div className="flex gap-2">
              <input
                value={icon}
                onChange={e => setIcon(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={handleChooseFile}
                disabled={imgUploading}
                className="px-3 py-2 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 border disabled:opacity-60"
                title="Upload ke Firebase Storage"
              >{imgUploading ? 'Mengunggah…' : 'Upload'}</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {icon?.trim() && (
              <div className="mt-2 text-xs text-gray-500">
                Pratinjau:
                <div className="mt-1">
                  <img src={icon} alt="icon preview" className="h-12 w-12 object-contain border rounded" />
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {error}
            </div>
          )}
          {ok && (
            <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">
              {ok}
            </div>
          )}
          <div className="flex justify-end">
            <button
              disabled={loading}
              className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Tambah Kategori'}
            </button>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Daftar Kategori</h2>
          <div className="bg-white border rounded-lg shadow-sm divide-y">
            {cats.length === 0 && (
              <div className="p-4 text-xs text-gray-500">Belum ada kategori.</div>
            )}
            {cats.map(cat => (
              <div key={cat.id} className="flex flex-col gap-3 p-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center rounded bg-gray-50 border">
                  {cat.icon ? (
                    <Image
                      src={cat.icon}
                      alt={cat.name}
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain"
                      onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                      priority
                    />
                  ) : (
                    <span className="text-[10px] text-gray-400 font-medium">NO ICON</span>
                  )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{cat.name}</div>
                    <div className="text-[11px] text-gray-500">/{cat.slug}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="px-2 py-1 text-[10px] rounded bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Hapus
                  </button>
                </div>

                {/* Discount controls */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Diskon (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={catEdits[cat.id]?.discountPercent ?? ''}
                      onChange={(e) => setEdit(cat.id, 'discountPercent', e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="0-90"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Mulai</label>
                    <input
                      type="datetime-local"
                      value={catEdits[cat.id]?.discountStart ?? ''}
                      onChange={(e) => setEdit(cat.id, 'discountStart', e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Selesai</label>
                    <input
                      type="datetime-local"
                      value={catEdits[cat.id]?.discountEnd ?? ''}
                      onChange={(e) => setEdit(cat.id, 'discountEnd', e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-5 md:mt-0">
                    <input
                      id={`active-${cat.id}`}
                      type="checkbox"
                      checked={!!catEdits[cat.id]?.discountActive}
                      onChange={(e) => setEdit(cat.id, 'discountActive', e.target.checked)}
                      className="h-4 w-4 text-orange-600 border-gray-300 rounded"
                    />
                    <label htmlFor={`active-${cat.id}`} className="text-sm text-gray-700">Aktif</label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => saveCategoryDiscount(cat)}
                      className="px-3 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700"
                    >Simpan Diskon</button>
                    <button
                      type="button"
                      onClick={() => setEdit(cat.id, 'discountPercent', 0) || setEdit(cat.id, 'discountActive', false)}
                      className="px-3 py-2 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 border"
                    >Nonaktifkan</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/** Spacer bottom */}
      <div className="h-10" />
    </AdminLayout>
  );
}