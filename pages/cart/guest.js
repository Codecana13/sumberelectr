import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { FaArrowLeft, FaShoppingCart, FaPlus } from 'react-icons/fa';
import { loadGuestCart, mapGuestItems, removeGuestItem } from '@/utils/guestCart';

// Helper pricing: mirror logic from auth cart to respect wholesale tiers if any
function computeUnitPrice(item, qty) {
  const q = Number(qty) || 0;
  const retail = Number(item.retailPrice ?? item.price ?? 0);
  let unitPrice = retail;
  let mode = 'retail';
  let appliedMinQty = null;

  if (Array.isArray(item.wholesaleTiers) && item.wholesaleTiers.length) {
    const tiers = item.wholesaleTiers
      .map(t => ({ minQty: Number(t.minQty), price: Number(t.price) }))
      .filter(t => t.minQty && t.price)
      .sort((a,b)=> a.minQty - b.minQty);
    let picked = null;
    for (const t of tiers) {
      if (q >= t.minQty) picked = t;
    }
    if (picked) {
      unitPrice = picked.price;
      mode = 'wholesale';
      appliedMinQty = picked.minQty;
    }
  } else {
    const min = Number(item.wholesaleMinQty ?? item.wholesaleMin ?? item.minWholesaleQty);
    const wPrice = Number(item.wholesalePrice ?? item.bulkPrice);
    if (min && wPrice && q >= min) {
      unitPrice = wPrice;
      mode = 'wholesale';
      appliedMinQty = min;
    }
  }
  return { unitPrice, mode, appliedMinQty };
}

function applyPricingToCartItems(items) {
  return items.map(it => {
    const { unitPrice, mode, appliedMinQty } = computeUnitPrice(it, it.quantity);
    return {
      ...it,
      retailPrice: it.retailPrice ?? it.price,
      price: unitPrice,
      priceMode: mode,
      wholesaleMinApplied: appliedMinQty ?? it.wholesaleMinApplied ?? null
    };
  });
}

export default function GuestCartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const selectAllRef = useRef(null);

  useEffect(() => {
    const { items } = loadGuestCart();
    setCartItems(applyPricingToCartItems(items || []));
  }, []);

  const getKey = (item, idx) => `${item.productId}-${item.variantLabel || ''}-${idx}`;

  const toggleSelectAll = () => {
    if (cartItems.length === 0) return;
    const allKeys = cartItems.map((it, idx) => getKey(it, idx));
    const allSelected = selectedKeys.length === cartItems.length && cartItems.length > 0;
    setSelectedKeys(allSelected ? [] : allKeys);
  };

  useEffect(() => {
    if (!selectAllRef.current) return;
    const total = cartItems.length;
    const selected = selectedKeys.length;
    selectAllRef.current.indeterminate = selected > 0 && selected < total;
  }, [selectedKeys, cartItems]);

  const handleSelectItem = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const handleQuantityChange = (key, newQty) => {
    if (newQty < 1) return;
    const updated = mapGuestItems((it, idx) => {
      const k = getKey(it, idx);
      if (k !== key) return it;
      const { unitPrice, mode, appliedMinQty } = computeUnitPrice(it, newQty);
      return {
        ...it,
        quantity: newQty,
        retailPrice: it.retailPrice ?? it.price,
        price: unitPrice,
        priceMode: mode,
        wholesaleMinApplied: appliedMinQty ?? it.wholesaleMinApplied ?? null
      };
    });
    setCartItems(applyPricingToCartItems(updated));
  };

  const handleRemoveItem = (key) => {
    const filtered = removeGuestItem((it, idx) => getKey(it, idx) === key);
    setCartItems(applyPricingToCartItems(filtered));
    setSelectedKeys(prev => prev.filter(k => k !== key));
  };

  const totalSelected = cartItems.filter((i, idx) => selectedKeys.includes(getKey(i, idx)));
  const totalPrice = totalSelected.reduce((sum, i) => sum + Number(i.price) * (Number(i.quantity) || 1), 0);
  const totalWeight = totalSelected.reduce((sum, i) => sum + (Number(i.weight) || 0) * (Number(i.quantity) || 1), 0);

  const handleProceedCheckout = () => {
    if (selectedKeys.length === 0) {
      alert('Pilih minimal 1 produk.');
      return;
    }
    // store selection to sessionStorage (productId + variantLabel)
    try {
      const selection = cartItems
        .map((it, idx) => ({ key: getKey(it, idx), productId: it.productId, variantLabel: it.variantLabel || '' }))
        .filter(x => selectedKeys.includes(x.key))
        .map(x => ({ productId: x.productId, variantLabel: x.variantLabel }));
      sessionStorage.setItem('guest_checkout_selection', JSON.stringify(selection));
    } catch {}
    router.push('/cart/guest-checkout');
  };

  return (
    <>
      <div className="flex items-center bg-white shadow px-4 py-3 sticky top-0 z-20">
        <button onClick={() => router.push('/')} className="mr-3" aria-label="Kembali">
          <FaArrowLeft className="text-xl text-gray-700" />
        </button>
        <h1 className="font-semibold text-lg flex items-center gap-2">
          <FaShoppingCart className="text-red-600" /> Keranjang Tamu
        </h1>
      </div>

      <div className="container mx-auto px-3 py-4 pb-28 min-h-screen">
        {cartItems.length === 0 ? (
          <div className="text-center text-gray-500">
            Keranjang kosong. <Link href="/" className="text-red-500 underline">Belanja sekarang!</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cartItems.length > 1 && (
              <div className="bg-white border rounded-lg shadow-sm p-3 flex items-center gap-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={selectedKeys.length === cartItems.length && cartItems.length > 0}
                  onChange={toggleSelectAll}
                  className="accent-red-600"
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Pilih semua</div>
                  <div className="text-xs text-gray-500">Centang semua item untuk checkout sekaligus</div>
                </div>
              </div>
            )}

            {cartItems.map((item, idx) => {
              const key = getKey(item, idx);
              return (
                <div key={key} className="bg-white border rounded-lg shadow-sm p-3 flex gap-3">
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(key)}
                    onChange={() => handleSelectItem(key)}
                    className="accent-red-600 mt-2"
                  />
                  <Image
                    src={item.image || '/placeholder.png'}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="w-14 h-14 object-cover rounded-md border"
                    priority
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.variantLabel && (
                        <p className="text-xs text-gray-500">Varian: {item.variantLabel}</p>
                      )}
                      <p className="text-red-600 font-bold text-sm mt-1">
                        Rp {Number(item.price).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => handleRemoveItem(key)}
                      className="text-gray-400 hover:text-red-600"
                      title="Hapus item"
                    >
                      &times;
                    </button>
                    <div className="flex items-center mt-2">
                      <button
                        onClick={() => handleQuantityChange(key, item.quantity - 1)}
                        disabled={
                          item.priceMode === 'wholesale' &&
                          item.quantity <= (item.wholesaleMinApplied
                            || item.wholesaleMinQty
                            || item.wholesaleMin
                            || item.minWholesaleQty
                            || 0)
                        }
                        className={`px-2 rounded ${
                          (item.priceMode === 'wholesale' &&
                           item.quantity <= (item.wholesaleMinApplied
                             || item.wholesaleMinQty
                             || item.wholesaleMin
                             || item.minWholesaleQty
                             || 0))
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-gray-200'
                        }`}
                      >-
                      </button>
                      <span className="px-3">{item.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(key, item.quantity + 1)}
                        className="px-2 rounded bg-gray-200"
                      >+
                      </button>
                    </div>
                  </div>
                  {item.priceMode === 'wholesale' ? (
                    <span className="inline-block bg-green-100 text-green-700 text-[10px] px-2 py-[2px] rounded mt-1">
                      Grosir
                    </span>
                  ) : (
                    <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-2 py-[2px] rounded mt-1">
                      Ecer
                    </span>
                  )}
                </div>
              );
            })}

            <div className="flex justify-center mt-6">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold shadow transition"
              >
                <FaPlus className="text-lg" />
                <span className="text-sm font-medium">Tambahkan produk lain</span>
              </button>
            </div>

            {selectedKeys.length > 0 && (
              <div className="mt-6 bg-white border-t pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 flex flex-col gap-1">
                  <p className="text-sm">
                    Total: <span className="font-semibold text-red-600">Rp {totalPrice.toLocaleString('id-ID')}</span>
                  </p>
                  <p className="text-xs text-gray-500">Berat: {totalWeight} gram</p>
                </div>
                <button
                  onClick={handleProceedCheckout}
                  className="bg-red-600 text-white px-5 py-2 rounded-full font-semibold text-sm shadow transition"
                >
                  Checkout ({selectedKeys.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
