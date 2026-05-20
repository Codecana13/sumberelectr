import { useEffect, useState } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { firestore } from "@/utils/firebase";
import AdminLayout from "../_layout";

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState([]);
  const [form, setForm] = useState({
    code: "",
    type: "percentage",
    value: "",
    maxDiscount: "",
    startDate: "",
    endDate: "",
  active: true,
  voucherKind: 'general', // 'general' | 'refund'
  totalQty: '',           // for general vouchers
  maxUses: '1',           // for refund vouchers
  allowedBuyerId: '',     // optional restriction for refund
  sourceInvoiceId: '',    // optional reference for refund
  });
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Helper konversi Timestamp / Date / string -> Date
  const asDate = (d) => {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d === 'object' && typeof d.seconds === 'number') return new Date(d.seconds * 1000);
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Ambil data voucher
  const fetchVouchers = async () => {
    const snapshot = await getDocs(collection(firestore, "vouchers"));
    const list = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      // Normalisasi beberapa field agar UI aman
      return {
        id: docSnap.id,
        ...data,
        // unify value for fixed voucher refund (amount field)
        _normValue: typeof data.value === 'number'
          ? data.value
          : (typeof data.amount === 'number' ? data.amount : 0),
        _normMaxDiscount: typeof data.maxDiscount === 'number'
          ? data.maxDiscount
          : (typeof data.max_discount === 'number' ? data.max_discount : null),
        _start: asDate(data.startDate) || asDate(data.createdAt),
        _end: asDate(data.endDate) || asDate(data.expiresAt),
  _voucherKind: data.voucherKind || (data.sourceInvoiceId ? 'refund' : 'general'),
  _totalQty: typeof data.totalQty === 'number' ? data.totalQty : null,
  _claimedCount: typeof data.claimedCount === 'number' ? data.claimedCount : 0,
  _maxUses: typeof data.max_uses === 'number' ? data.max_uses : (typeof data.maxUses === 'number' ? data.maxUses : null),
  _used: typeof data.used === 'number' ? data.used : 0,
  _allowedBuyerId: data.allowedBuyerId || '',
  _sourceInvoiceId: data.sourceInvoiceId || '',
      };
    });
    setVouchers(list);
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  // Tambah / update voucher
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const numericVal = Number(form.value);
      const numericMax = form.type === "percentage" && form.maxDiscount !== ""
        ? Number(form.maxDiscount)
        : null;
      const start = form.startDate ? new Date(form.startDate) : new Date();
      const end = form.endDate ? new Date(form.endDate) : null;

      // Validate voucher kind specifics
      if (form.voucherKind === 'general') {
        const qty = Number(form.totalQty);
        if (!Number.isFinite(qty) || qty < 1) {
          alert('Jumlah voucher (kuota) wajib diisi dan minimal 1.');
          setLoading(false);
          return;
        }
      } else if (form.voucherKind === 'refund') {
        const mu = Number(form.maxUses);
        if (!Number.isFinite(mu) || mu < 1) {
          alert('Max pemakaian untuk voucher refund minimal 1.');
          setLoading(false);
          return;
        }
      }

      const payload = {
        code: form.code.trim(),
        type: form.type,
        value: numericVal,
        amount: form.type === 'fixed' ? numericVal : null, // sinkron supaya seragam
        maxDiscount: numericMax,
        startDate: start,
        endDate: end,
        active: !!form.active,
        updatedAt: new Date(),
        voucherKind: form.voucherKind,
        // General kind fields
        ...(form.voucherKind === 'general' ? {
          totalQty: Number(form.totalQty),
        } : {}),
        // Refund kind fields
        ...(form.voucherKind === 'refund' ? {
          max_uses: Number(form.maxUses),
          allowedBuyerId: form.allowedBuyerId?.trim() || null,
          sourceInvoiceId: form.sourceInvoiceId?.trim() || null,
        } : {}),
      };

      if (!editId) {
        payload.createdAt = new Date();
        // Initialize usage counters
        if (form.voucherKind === 'general') {
          payload.claimedCount = 0;
        } else if (form.voucherKind === 'refund') {
          payload.used = 0;
          payload.usedBy = [];
        }
        await setDoc(doc(firestore, "vouchers", payload.code || undefined), payload); // pakai code sbg id jika diisi
      } else {
        // On update, do NOT reset counters claimedCount/used/usedBy if they already exist
        await updateDoc(doc(firestore, "vouchers", editId), payload);
      }

      setForm({
        code: "",
        type: "percentage",
        value: "",
        maxDiscount: "",
        startDate: "",
        endDate: "",
  active: true,
  voucherKind: 'general',
  totalQty: '',
  maxUses: '1',
  allowedBuyerId: '',
  sourceInvoiceId: '',
      });
      setEditId(null);
      setShowModal(false);
      fetchVouchers();
    } catch (err) {
      console.error("Error saving voucher:", err);
    }
    setLoading(false);
  };

  // Hapus voucher
  const handleDelete = async (id) => {
    if (confirm("Yakin ingin menghapus voucher ini?")) {
      await deleteDoc(doc(firestore, "vouchers", id));
      fetchVouchers();
    }
  };

  // Edit voucher
  const handleEdit = (voucher) => {
    const startISO = voucher._start ? voucher._start.toISOString().slice(0,10) : "";
    const endISO = voucher._end ? voucher._end.toISOString().slice(0,10) : "";
    setForm({
      code: voucher.code || "",
      type: voucher.type || "percentage",
      value: voucher._normValue || "",
      maxDiscount: voucher._normMaxDiscount ?? "",
      startDate: startISO,
      endDate: endISO,
      active: voucher.active !== false,
  voucherKind: voucher._voucherKind || 'general',
  totalQty: voucher._totalQty ?? '',
  maxUses: (voucher._maxUses ?? 1).toString(),
  allowedBuyerId: voucher._allowedBuyerId || '',
  sourceInvoiceId: voucher._sourceInvoiceId || '',
    });
    setEditId(voucher.id);
    setShowModal(true);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Manajemen Voucher</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded bg-primary text-white hover:bg-blueDark transition"
          >
            + Buat Voucher
          </button>
        </div>

        {/* Daftar Voucher */}
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-100 text-gray-700 text-left">
              <tr>
                <th className="px-4 py-3 border-b">Kode</th>
                <th className="px-4 py-3 border-b">Jenis</th>
                <th className="px-4 py-3 border-b">Nilai</th>
                <th className="px-4 py-3 border-b">Maks. Diskon</th>
                <th className="px-4 py-3 border-b">Periode</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b">Kuota/Pemakaian</th>
                <th className="px-4 py-3 border-b text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.map(v => {
                const isPercentage = v.type === 'percentage';
                const displayValue = isPercentage
                  ? `${(v._normValue ?? 0)}%`
                  : `Rp ${(v._normValue ?? 0).toLocaleString('id-ID')}`;
                const displayMax = isPercentage && v._normMaxDiscount
                  ? `Rp ${(v._normMaxDiscount).toLocaleString('id-ID')}`
                  : '-';
                const period = (v._start ? v._start.toLocaleDateString('id-ID') : '?')
                  + ' - ' +
                  (v._end ? v._end.toLocaleDateString('id-ID') : (v.expiresAt ? asDate(v.expiresAt).toLocaleDateString('id-ID') : '—'));
                return (
                  <tr key={v.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                      {v.code}
                      {(v._voucherKind === 'refund' || v.sourceInvoiceId) && (
                        <span className="text-[10px] px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-semibold">
                          Refund
                        </span>
                      )}
                      {v._voucherKind === 'general' && (
                        <span className="text-[10px] px-2 py-[2px] rounded-full bg-red-100 text-red-700 font-semibold">
                          Umum
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{v.type}</td>
                    <td className="px-4 py-3">{displayValue}</td>
                    <td className="px-4 py-3">{displayMax}</td>
                    <td className="px-4 py-3 text-gray-600">{period}</td>
                    <td className="px-4 py-3">
                      {v.active ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 font-medium">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {v._voucherKind === 'general' ? (
                        <>
                          <span className="font-medium">{Math.max((v._totalQty ?? 0) - (v._claimedCount ?? 0), 0)}</span>
                          <span className="text-gray-400"> / {v._totalQty ?? 0}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{v._used ?? 0}</span>
                          <span className="text-gray-400"> / {v._maxUses ?? 1}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(v)}
                        className="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-blueDark transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="px-3 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
        {vouchers.length === 0 && (
                <tr>
          <td colSpan="8" className="text-center py-6 text-gray-500">
                    Belum ada voucher.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Form Voucher */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-lg">
              <h2 className="text-lg font-semibold mb-4">
                {editId ? "Edit Voucher" : "Buat Voucher"}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <input
                  type="text"
                  placeholder="Kode Voucher"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
                {/* Kategori Voucher */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">Kategori</label>
                    <select
                      value={form.voucherKind}
                      onChange={(e) => setForm({ ...form, voucherKind: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="general">Umum (bisa diklaim semua user)</option>
                      <option value="refund">Refund Khusus</option>
                    </select>
                  </div>
                  {form.voucherKind === 'general' && (
                    <div>
                      <label className="text-xs text-gray-600">Jumlah Voucher (Kuota)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="cth 100"
                        value={form.totalQty}
                        onChange={(e) => setForm({ ...form, totalQty: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        required
                      />
                    </div>
                  )}
                  {form.voucherKind === 'refund' && (
                    <div>
                      <label className="text-xs text-gray-600">Max Pemakaian</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="cth 1"
                        value={form.maxUses}
                        onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        required
                      />
                    </div>
                  )}
                </div>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="percentage">Persentase</option>
                  <option value="fixed">Nominal</option>
                </select>
                <input
                  type="number"
                  placeholder="Nilai"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
                {form.type === "percentage" && (
                  <input
                    type="number"
                    placeholder="Maksimum Diskon"
                    value={form.maxDiscount}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                )}
                {form.voucherKind === 'refund' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        placeholder="Allowed Buyer UID (opsional)"
                        value={form.allowedBuyerId}
                        onChange={(e) => setForm({ ...form, allowedBuyerId: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Source Invoice ID (opsional)"
                        value={form.sourceInvoiceId}
                        onChange={(e) => setForm({ ...form, sourceInvoiceId: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-1/2 border rounded px-3 py-2"
                    required
                  />
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-1/2 border rounded px-3 py-2"
                    required
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  Aktif
                </label>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditId(null);
                      setForm({
                        code: "",
                        type: "percentage",
                        value: "",
                        maxDiscount: "",
                        startDate: "",
                        endDate: "",
                        active: true,
                        voucherKind: 'general',
                        totalQty: '',
                        maxUses: '1',
                        allowedBuyerId: '',
                        sourceInvoiceId: '',
                      });
                    }}
                    className="px-4 py-2 rounded border hover:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 rounded bg-primary text-white hover:bg-blueDark"
                  >
                    {loading ? "Menyimpan..." : editId ? "Update" : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
