// Simple guest cart stored in localStorage
// Structure: { items: Array<CartItem> }

const KEY = 'guest_cart_v1';

export function loadGuestCart() {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [] };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.items)) return { items: [] };
    return { items: data.items };
  } catch {
    return { items: [] };
  }
}

export function saveGuestCart(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ items }));
  } catch {}
}

export function addGuestItem(newItem) {
  const { items } = loadGuestCart();
  const idx = items.findIndex(i => i.productId === newItem.productId && (i.variantLabel || '') === (newItem.variantLabel || ''));
  if (idx >= 0) {
    items[idx].quantity = Number(items[idx].quantity || 0) + Number(newItem.quantity || 1);
    // Keep latest price/weight info
    items[idx].price = Number(newItem.price || items[idx].price || 0);
    items[idx].retailPrice = Number(newItem.retailPrice || items[idx].retailPrice || items[idx].price || 0);
    items[idx].priceMode = newItem.priceMode || items[idx].priceMode || 'retail';
    items[idx].weight = Number(newItem.weight || items[idx].weight || 0);
  } else {
    items.push(newItem);
  }
  saveGuestCart(items);
  return items;
}

export function removeGuestItem(predicate) {
  const { items } = loadGuestCart();
  const filtered = items.filter((it, idx) => !predicate(it, idx));
  saveGuestCart(filtered);
  return filtered;
}

export function mapGuestItems(mapper) {
  const { items } = loadGuestCart();
  const mapped = items.map(mapper);
  saveGuestCart(mapped);
  return mapped;
}
