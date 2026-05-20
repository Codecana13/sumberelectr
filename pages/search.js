import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '@/utils/firebase';
import { FaArrowLeft, FaSearch } from 'react-icons/fa';
import PopupCart from '@/components/PopupCart';
import Image from 'next/image';

const SearchPage = () => {
  const router = useRouter();
  const { q } = router.query;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(q || '');
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (!q) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const productsCol = collection(firestore, 'products');
        const productsSnapshot = await getDocs(productsCol);
        const filteredProducts = productsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p =>
            (p.name || '').toLowerCase().includes(q.toLowerCase()) ||
            (p.productName || '').toLowerCase().includes(q.toLowerCase())
          );
        setProducts(filteredProducts);
      } catch (err) {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [q]);

  const handleProductClick = (productSlug) => {
    router.push(`/product/${productSlug}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
  };

  const handleAddToCart = (product) => {
    setSelectedProduct(product);
    setShowCartPopup(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="flex items-center bg-white shadow px-4 py-3 sticky top-0 z-20">
        <button onClick={() => router.push('/')} className="mr-3">
          <FaArrowLeft className="text-xl text-gray-700" />
        </button>
        <form
          onSubmit={handleSearch}
          className="flex-1 flex h-11 rounded-full bg-white/80 backdrop-blur border border-red-100 shadow focus-within:ring-2 focus-within:ring-orange-400/40 transition overflow-hidden"
          role="search"
          aria-label="Pencarian produk"
        >
          <input
            type="search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari produk..."
            className="flex-1 px-4 text-sm bg-transparent outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            className="px-5 flex items-center justify-center text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 focus:outline-none"
            aria-label="Cari"
          >
            <FaSearch />
            <span className="sr-only">Cari</span>
          </button>
        </form>
      </div>

      <main className="container mx-auto px-4 py-8 min-h-screen">
        <h2 className="text-xl font-semibold mb-6 text-orange-700">Hasil Pencarian: &quot;{q}&quot;</h2>
        {loading && <p className="text-orange-600 font-semibold">Loading...</p>}
        {!loading && (
          <section>
            {products.length === 0 ? (
              <p className="text-gray-500">Tidak ditemukan produk.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {products.map((product) => (
                  <div key={product.id} onClick={() => handleProductClick(product.productSlug)}>
                    {/* Ganti <img> dengan <Image /> di ProductCard */}
                    <ProductCard product={product} onAddToCart={handleAddToCart} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      {/* PopupCart muncul di sini */}
      <PopupCart
        show={showCartPopup}
        onClose={() => setShowCartPopup(false)}
        product={selectedProduct}
        // ...prop lain sesuai kebutuhan...
      />
    </div>
  );
};

export default SearchPage;
