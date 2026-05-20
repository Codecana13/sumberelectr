import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, updateDoc, limit, startAfter } from 'firebase/firestore';
import { firestore } from '@/utils/firebase';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
// dynamic import client-only editor
const ArticleEditorClient = dynamic(() => import('@/components/ArticleEditorClient'), { ssr: false });
import AdminLayout from '../_layout';

export default function ArticleUploadPage() {
  const router = useRouter();
  const editorRef = useRef(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [image, setImage] = useState('');
  const [keywords, setKeywords] = useState('');
  const [author, setAuthor] = useState('Admin');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewText, setPreviewText] = useState('');

  // Management table states
  const [articles, setArticles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [qSearch, setQSearch] = useState('');
  const [qCategory, setQCategory] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState(null);

  // pagination
  const PAGE_SIZE = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const cursorsRef = useRef({}); // store lastVisible docs per page: cursorsRef.current[page] = lastDoc
  const [pagedArticles, setPagedArticles] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalFetchedForSearch, setTotalFetchedForSearch] = useState(null);

  // Slug generator
  const slugify = s =>
    (s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // Auto slug
  const handleTitleChange = val => {
    setTitle(val);
    setSlug(slugify(val));
  };

  // Fetch categories dari Firestore (dinamis)
  useEffect(() => {
    let mounted = true;
    async function fetchCategories() {
      try {
        const catSnap = await getDocs(collection(firestore, 'categories'));
        const cats = catSnap.docs.map(d => {
          const data = d.data();
          return {
            slug: data.slug || d.id,
            name: data.name || data.slug || d.id,
            icon: data.icon || ''
          };
        });
        if (mounted) setCategories(cats);
      } catch (err) {
        setCategories([]);
      }
    }
    fetchCategories();
    return () => { mounted = false; };
  }, []);

  // Fetch page (server-side pagination). If qSearch is present we fetch all then filter client-side.
  useEffect(() => {
    let mounted = true;
    setFetching(true);
    async function loadPage(page = 1) {
      try {
        // If there's a search query, fetch all once and do client-side filter/pagination
        if ((qSearch || '').trim().length > 0) {
          const qAll = query(collection(firestore, 'articles'), orderBy('createdAt', 'desc'));
          const snapAll = await getDocs(qAll);
          const all = snapAll.docs.map(d => ({ id: d.id, ...d.data() }));
          if (!mounted) return;
          setArticles(all);
          setTotalFetchedForSearch(all.length);
          // client-side filter
          const filteredAll = all.filter(a =>
            (qCategory === '' || a.category === qCategory) &&
            (
              (a.title || '').toLowerCase().includes(qSearch.toLowerCase()) ||
              (a.excerpt || '').toLowerCase().includes(qSearch.toLowerCase()) ||
              (a.contentText || '').toLowerCase().includes(qSearch.toLowerCase())
            )
          );
          const start = (page - 1) * PAGE_SIZE;
          setPagedArticles(filteredAll.slice(start, start + PAGE_SIZE));
          setHasNextPage(filteredAll.length > start + PAGE_SIZE);
          setCurrentPage(page);
          setFetching(false);
          return;
        }

        // normal paginated load (no search)
        const articlesCol = collection(firestore, 'articles');
        let q;
        if (page === 1) {
          q = query(articlesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        } else {
          const cursor = cursorsRef.current[page - 1];
          if (!cursor) {
            // attempt to rebuild cursors by fetching previous pages sequentially
            let prevCursor = null;
            for (let p = 1; p < page; p++) {
              const qtmp = prevCursor
                ? query(articlesCol, orderBy('createdAt', 'desc'), startAfter(prevCursor), limit(PAGE_SIZE))
                : query(articlesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
              const snapTmp = await getDocs(qtmp);
              if (snapTmp.empty) break;
              prevCursor = snapTmp.docs[snapTmp.docs.length - 1];
              cursorsRef.current[p] = prevCursor;
            }
          }
          const startAfterDoc = cursorsRef.current[page - 1];
          q = startAfterDoc
            ? query(articlesCol, orderBy('createdAt', 'desc'), startAfter(startAfterDoc), limit(PAGE_SIZE))
            : query(articlesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        }

        const snap = await getDocs(q);
        if (!mounted) return;
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPagedArticles(docs);
        // store last visible doc for this page
        cursorsRef.current[page] = snap.docs[snap.docs.length - 1] || null;
        setHasNextPage(snap.docs.length === PAGE_SIZE);
        setCurrentPage(page);
      } catch (err) {
        console.error('load articles', err);
      } finally {
        if (mounted) setFetching(false);
      }
    }
    loadPage(1);
    return () => { mounted = false; };
  }, [refreshKey, qSearch, qCategory]);

  const goNext = async () => {
    if (!hasNextPage) return;
    setFetching(true);
    await (async () => {
      const nextPage = currentPage + 1;
      // reuse load logic by calling effect via refreshKey + temp state change
      // directly call loadPage-like logic here for immediate nav
      try {
        const articlesCol = collection(firestore, 'articles');
        const cursor = cursorsRef.current[currentPage];
        const q = cursor
          ? query(articlesCol, orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE))
          : query(articlesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPagedArticles(docs);
        cursorsRef.current[nextPage] = snap.docs[snap.docs.length - 1] || null;
        setHasNextPage(snap.docs.length === PAGE_SIZE);
        setCurrentPage(nextPage);
      } catch (err) {
        console.error(err);
      } finally { setFetching(false); }
    })();
  };

  const goPrev = async () => {
    if (currentPage <= 1) return;
    setFetching(true);
    try {
      const prevPage = currentPage - 1;
      // to get prev page, we query using startAfter(cursorsRef.current[prevPage - 1]) (or no cursor for page 1)
      const articlesCol = collection(firestore, 'articles');
      const cursorForPrev = prevPage === 1 ? null : cursorsRef.current[prevPage - 1];
      const q = cursorForPrev
        ? query(articlesCol, orderBy('createdAt', 'desc'), startAfter(cursorForPrev), limit(PAGE_SIZE))
        : query(articlesCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPagedArticles(docs);
      setCurrentPage(prevPage);
      setHasNextPage(true);
    } catch (err) {
      console.error(err);
    } finally { setFetching(false); }
  };

  // helper: when creating new article without custom date, assign random publish date between Jan 1 and Sep 22 (current year)
  function randomPublishDate() {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1).getTime(); // Jan 1
    const end = new Date(year, 8, 22).getTime(); // Sep 22 (month index 8)
    const t = Math.floor(start + Math.random() * (end - start));
    const d = new Date(t);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  // Submit (create or update)
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // prefer the editor DOM HTML if available
    const finalContent = editorRef.current && typeof editorRef.current.getHTML === 'function'
      ? editorRef.current.getHTML()
      : content;

    // plain text fallback for excerpt/seo
    const plain = editorRef.current && typeof editorRef.current.getText === 'function'
      ? editorRef.current.getText()
      : (content || '');
    const finalExcerpt = excerpt || (plain ? plain.slice(0, 160) : '');

    if (!title || !slug || !category || !finalContent) {
      setErrorMsg('Judul, slug, kategori, dan konten wajib diisi.');
      setLoading(false);
      return;
    }

    try {
      if (editingId) {
        // update existing
        await updateDoc(doc(firestore, 'articles', editingId), {
          title,
          slug,
          excerpt: finalExcerpt,
          category,
          image,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          author,
          date,
          content: finalContent,
          contentText: plain,
          updatedAt: serverTimestamp()
        });
        setSuccessMsg('Artikel berhasil di-update!');
        setEditingId(null);
      } else {
        // create new
        await addDoc(collection(firestore, 'articles'), {
          title,
          slug,
          excerpt: finalExcerpt,
          category,
          image,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          author,
          date: (date ? date : randomPublishDate()),
          content: finalContent,
          contentText: plain,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setSuccessMsg('Artikel berhasil di-upload!');
      }
      // clear form
      setTitle(''); setSlug(''); setExcerpt(''); setCategory(''); setImage('');
      setKeywords(''); setAuthor('Admin'); setDate(new Date().toISOString().slice(0,10));
      setContent('');
      setTimeout(() => {
        setSuccessMsg('');
        // refresh articles list
        setRefreshKey(k => k + 1);
      }, 900);
    } catch (err) {
      setErrorMsg('Gagal upload artikel: ' + err.message);
    }
    setLoading(false);
  };

  const handleEdit = (a) => {
    setEditingId(a.id);
    setTitle(a.title || '');
    setSlug(a.slug || '');
    setExcerpt(a.excerpt || '');
    setCategory(a.category || '');
    setImage(a.image || '');
    setKeywords(Array.isArray(a.keywords) ? a.keywords.join(', ') : (a.keywords || ''));
    setAuthor(a.author || 'Admin');
    setDate(a.date || new Date().toISOString().slice(0,10));
    setContent(a.content || a.contentHtml || '');
    // focus editor after a short delay
    setTimeout(() => editorRef.current?.focus?.(), 200);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus artikel ini? Aksi tidak dapat dibatalkan.')) return;
    try {
      await deleteDoc(doc(firestore, 'articles', id));
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const filtered = articles.filter(a =>
    (qCategory === '' || a.category === qCategory) &&
    (
      (a.title || '').toLowerCase().includes(qSearch.toLowerCase()) ||
      (a.excerpt || '').toLowerCase().includes(qSearch.toLowerCase()) ||
      (a.contentText || '').toLowerCase().includes(qSearch.toLowerCase())
    )
  );

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-primary">{editingId ? 'Edit Artikel' : 'Upload Artikel Baru'}</h1>
          {editingId && (
            <button
              className="px-3 py-1 rounded border text-sm"
              onClick={() => {
                // cancel editing
                setEditingId(null);
                setTitle(''); setSlug(''); setExcerpt(''); setCategory('');
                setImage(''); setKeywords(''); setAuthor('Admin'); setDate(new Date().toISOString().slice(0,10));
                setContent('');
              }}
            >
              Batal Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 mb-8">
          <div>
            <label className="block font-semibold mb-1">Judul Artikel *</label>
            <input
              type="text"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Slug (otomatis)</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(slugify(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Excerpt (ringkasan)</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              maxLength={200}
              placeholder="Ringkasan singkat artikel"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Kategori *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg w-full"
              required
            >
              <option value="">Pilih kategori</option>
              {categories.map(cat => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.icon && (
                    <img src={cat.icon} alt="" className="inline-block w-4 h-4 mr-1" />
                  )}
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Gambar Artikel (URL)</label>
            <input
              type="text"
              value={image}
              onChange={e => setImage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Keyword SEO (pisahkan dengan koma)</label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="peralatan listrik, mcb, contactor, power supply, kabel duct"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Author</label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Konten Artikel *</label>
            <ArticleEditorClient initial={content} onReady={api => { editorRef.current = api; }} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border bg-white text-primary"
              onClick={() => {
                const html = editorRef.current?.getHTML?.() || '';
                const text = editorRef.current?.getText?.() || '';
                setPreviewHtml(html);
                setPreviewText(text);
                setShowPreview(true);
              }}
            >
              Preview
            </button>
            <div className="flex-1" />
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-primary text-white font-bold"
              disabled={loading}
            >
              {loading ? (editingId ? 'Updating...' : 'Mengupload...') : (editingId ? 'Update Artikel' : 'Upload Artikel')}
            </button>
          </div>

          {errorMsg && <div className="text-red-600">{errorMsg}</div>}
          {successMsg && <div className="text-green-600">{successMsg}</div>}
        </form>

        {/* Management table */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Daftar Artikel</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Cari judul, excerpt atau konten..."
                className="px-3 py-2 border rounded-lg"
                value={qSearch}
                onChange={e => setQSearch(e.target.value)}
              />
              <select value={qCategory} onChange={e => setQCategory(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="">Semua Kategori</option>
                {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <button className="px-3 py-2 rounded-lg border" onClick={() => { setQSearch(''); setQCategory(''); }}>Reset</button>
            </div>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full divide-y">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Title</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Category</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Author</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y">
                {fetching ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center">Memuat…</td></tr>
                ) : (pagedArticles.length === 0) ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Belum ada artikel.</td></tr>
                ) : (
                  pagedArticles.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold">{a.title}</div>
                        <div className="text-xs text-gray-500">{a.excerpt}</div>
                      </td>
                      <td className="px-4 py-3 align-top">{categories.find(c => c.slug === a.category)?.name || a.category}</td>
                      <td className="px-4 py-3 align-top">{a.author}</td>
                      <td className="px-4 py-3 align-top">{a.date ? new Date(a.date).toLocaleDateString('id-ID') : (a.createdAt ? new Date(a.createdAt.seconds ? a.createdAt.seconds * 1000 : a.createdAt).toLocaleDateString('id-ID') : '')}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex gap-2">
                          <button className="px-2 py-1 rounded border text-sm" onClick={() => handleEdit(a)}>Edit</button>
                          <button className="px-2 py-1 rounded border text-sm text-red-600" onClick={() => handleDelete(a.id)}>Delete</button>
                          <button className="px-2 py-1 rounded border text-sm" onClick={() => {
                            // quick copy link
                            const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                            const url = `${site.replace(/\/$/,'')}/article/${a.slug}`;
                            navigator.clipboard?.writeText(url);
                            alert('Link artikel disalin ke clipboard');
                          }}>Copy Link</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* pagination controls */}
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-600">Halaman {currentPage}</div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded border" onClick={goPrev} disabled={currentPage === 1 || fetching}>Prev</button>
              <button className="px-3 py-1 rounded border" onClick={goNext} disabled={!hasNextPage || fetching}>Next</button>
            </div>
          </div>
        </section>

        {/* Preview modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl overflow-auto">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="font-bold">{title || 'Preview Artikel'}</h3>
                  <div className="text-sm text-gray-500">{category} — {author}</div>
                </div>
                <button className="text-xl px-3" onClick={() => setShowPreview(false)}>&times;</button>
              </div>
              <div className="p-6">
                {image && <img src={image} alt="hero" className="w-full max-h-64 object-cover rounded mb-4" />}
                <div className="prose max-w-full" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <div className="mt-4 text-xs text-gray-500">Plain text preview: {previewText.slice(0, 300)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
