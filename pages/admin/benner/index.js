import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { auth, firestore, storage } from '../../../utils/firebase';
import {
  collection,
  getDocs,
  addDoc,
  query,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import AdminLayout from '../_layout';
import Image from 'next/image';

// Simple image compression using browser canvas
const compressImage = (file, maxWidth = 1200, quality = 0.7) =>
  new Promise((resolve) => {
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: blob.type }));
          },
          'image/jpeg',
          quality
        );
      };
    };
    reader.readAsDataURL(file);
  });

export default function BannerAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({
    images: [null, null, null, null, null],
    startDate: '',
    endDate: '',
    existingImages: ['', '', '', '', ''],
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState(null);
  const fileInputRefs = [useRef(), useRef(), useRef(), useRef(), useRef()];

  // Auth protection
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists() || userSnap.data().role !== 'admin') {
        router.push('/unauthorized');
        return;
      }
      setUser(user);
      setLoading(false);
      fetchBanners();
    });
    return () => unsubscribe();
  }, [router]);

  const fetchBanners = async () => {
    const q = query(collection(firestore, 'banners'));
    const snap = await getDocs(q);
    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setBanners(list);
  };

  // Delete banner and images from storage
  const handleDelete = async (id) => {
    if (confirm('Delete this banner?')) {
      const banner = banners.find((b) => b.id === id);
      if (banner && banner.images) {
        for (const imgUrl of banner.images || []) {
          if (imgUrl) {
            try {
              const match = imgUrl.match(/\/o\/(.*?)\?/);
              const path = match ? decodeURIComponent(match[1]) : null;
              if (path) {
                const imgRef = ref(storage, path);
                await deleteObject(imgRef);
              }
            } catch (e) {}
          }
        }
      }
      await deleteDoc(doc(firestore, 'banners', id));
      setBanners(banners.filter((b) => b.id !== id));
    }
  };

  // Form change handler
  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name.startsWith('image')) {
      const idx = Number(name.replace('image', ''));
      const newImages = [...form.images];
      newImages[idx] = files[0];
      setForm({ ...form, images: newImages });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Validate form
  const validateForm = () => {
    if (!form.startDate || !form.endDate) {
      setError('Tanggal mulai dan akhir harus diisi.');
      return false;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError('Tanggal akhir harus setelah tanggal mulai.');
      return false;
    }
    if (!form.images.some((img, idx) => img || form.existingImages[idx])) {
      setError('Minimal satu gambar banner harus diupload.');
      return false;
    }
    return true;
  };

  // Add or edit banner
  const handleAddOrEditBanner = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!validateForm()) return;
    setUploading(true);

    // Upload & compress images
    let imageUrls = [...form.existingImages];
    for (let i = 0; i < 5; i++) {
      if (form.images[i]) {
        const compressed = await compressImage(form.images[i]);
        const imageRef = ref(storage, `banners/${Date.now()}_${form.images[i].name}`);
        await uploadBytes(imageRef, compressed);
        const url = await getDownloadURL(imageRef);

        // If editing, delete old image if replaced
        if (editId && form.existingImages[i]) {
          try {
            const match = form.existingImages[i].match(/\/o\/(.*?)\?/);
            const path = match ? decodeURIComponent(match[1]) : null;
            if (path) {
              const imgRef = ref(storage, path);
              await deleteObject(imgRef);
            }
          } catch (e) {}
        }
        imageUrls[i] = url;
      }
    }

    const bannerData = {
      images: imageUrls,
      startDate: form.startDate,
      endDate: form.endDate,
      createdAt: new Date(),
    };

    try {
      if (editId) {
        await setDoc(doc(firestore, 'banners', editId), bannerData, { merge: true });
        setSuccess('Banner berhasil diubah.');
      } else {
        await addDoc(collection(firestore, 'banners'), bannerData);
        setSuccess('Banner berhasil ditambahkan.');
      }
      setForm({
        images: [null, null, null, null, null],
        startDate: '',
        endDate: '',
        existingImages: ['', '', '', '', ''],
      });
      fileInputRefs.forEach((ref) => ref.current && (ref.current.value = ''));
      setEditId(null);
      fetchBanners();
    } catch (err) {
      setError('Gagal menyimpan banner.');
    } finally {
      setUploading(false);
    }
  };

  // Edit banner handler
  const handleEdit = (banner) => {
    setForm({
      images: [null, null, null, null, null],
      startDate: banner.startDate || '',
      endDate: banner.endDate || '',
      existingImages: banner.images || ['', '', '', '', ''],
    });
    fileInputRefs.forEach((ref) => ref.current && (ref.current.value = ''));
    setEditId(banner.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Notifikasi banner expired (dummy, integrasi dashboard notifikasi bisa ditambah)
  useEffect(() => {
    if (banners.length > 0) {
      const now = new Date();
      banners.forEach((banner) => {
        if (banner.endDate && new Date(banner.endDate) < now) {
          // TODO: Integrasi ke dashboard notifikasi admin
          // alert(`Banner dengan ID ${banner.id} sudah habis masa tayang.`);
        }
      });
    }
  }, [banners]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-lg text-gray-500">Loading...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-white px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-primary mb-6">Manajemen Banner Promosi</h1>

          {/* Form Tambah/Ubah Banner */}
          <form
            onSubmit={handleAddOrEditBanner}
            className="bg-red-50 border border-red-200 rounded-xl p-6 mb-10 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-red-700 mb-4">
              {editId ? 'Ubah Banner' : 'Tambah Banner Baru'}
            </h2>
            {error && (
              <div className="bg-red-100 text-red-700 text-sm p-2 mb-3 rounded">{error}</div>
            )}
            {success && (
              <div className="bg-green-100 text-green-700 text-sm p-2 mb-3 rounded">{success}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Mulai Tayang</label>
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Akhir Tayang</label>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {[0, 1, 2, 3, 4].map((idx) => (
                <div key={idx}>
                  <label className="block text-sm font-medium mb-1">{`Upload Banner ${idx + 1}`}</label>
                  <input
                    type="file"
                    name={`image${idx}`}
                    accept="image/*"
                    ref={fileInputRefs[idx]}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {editId && form.existingImages[idx] && (
                    <Image
                      src={form.existingImages[idx]}
                      alt={`Banner ${idx + 1}`}
                      width={96}
                      height={48}
                      className="mt-2 rounded border object-cover"
                      style={{ width: '96px', height: '48px' }}
                      priority
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="mt-6 bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-70"
            >
              {uploading ? (editId ? 'Mengubah...' : 'Uploading...') : (editId ? 'Ubah Banner' : 'Tambah Banner')}
            </button>
          </form>

          {/* Tabel Banner */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-red-100 rounded-xl shadow-sm">
              <thead className="bg-red-700 text-white">
                <tr>
                  <th className="py-3 px-4 text-left">Banner</th>
                  <th className="py-3 px-4 text-left">Tayang</th>
                  <th className="py-3 px-4 text-left">Berakhir</th>
                  <th className="py-3 px-4 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {banners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-500">Belum ada banner.</td>
                  </tr>
                ) : (
                  banners.map((banner) => (
                    <tr key={banner.id} className="border-b border-gray-100">
                      <td className="py-2 px-4 flex gap-2">
                        {(banner.images || []).map((img, idx) =>
                          img ? (
                            <Image
                              key={idx}
                              src={img}
                              alt={`Banner ${idx + 1}`}
                              width={96}
                              height={48}
                              className="w-24 h-12 object-cover rounded border"
                              style={{ width: '96px', height: '48px' }}
                              priority
                            />
                          ) : null
                        )}
                      </td>
                      <td className="py-2 px-4">{banner.startDate}</td>
                      <td className="py-2 px-4">{banner.endDate}</td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() => handleEdit(banner)}
                          className="text-blue-600 hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(banner.id)}
                          className="text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                        {banner.endDate && new Date(banner.endDate) < new Date() && (
                          <span className="ml-2 text-xs text-red-600 font-bold">Expired</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}