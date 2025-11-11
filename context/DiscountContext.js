import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/utils/firebase';

/*
  DiscountContext
  - Subscribes to categories collection and builds a mapping of active discounts per category.
  - Expected category doc fields (optional):
      - discountPercent: number (0-100)
      - discountActive: boolean
      - discountStart: Timestamp | number | string date
      - discountEnd: Timestamp | number | string date
  - Active rule: discountActive true AND now within [start,end] if provided.
  - Keys provided: category slug and name (both lowercased) to be robust against product.category storing either.
*/

const DiscountContext = createContext({
  map: {},
  // helper to get active discount for a category key (slug or name)
  getFor: () => 0
});

export function DiscountProvider({ children }) {
  const [map, setMap] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'categories'), (snap) => {
      const now = Date.now();
      const m = {};
      snap.forEach((d) => {
        const data = d.data() || {};
        const percent = Number(data.discountPercent) || 0;
        const activeFlag = data.discountActive === true || (data.discountActive === undefined && percent > 0);
        const start = data.discountStart?.toDate?.() ? data.discountStart.toDate().getTime() : (
          typeof data.discountStart === 'number' ? data.discountStart : (data.discountStart ? Date.parse(data.discountStart) : undefined)
        );
        const end = data.discountEnd?.toDate?.() ? data.discountEnd.toDate().getTime() : (
          typeof data.discountEnd === 'number' ? data.discountEnd : (data.discountEnd ? Date.parse(data.discountEnd) : undefined)
        );
        let within = true;
        if (start && now < start) within = false;
        if (end && now > end) within = false;
        const isActive = activeFlag && within && percent > 0 && percent <= 90;
        if (!isActive) return;
        const slug = (data.slug || '').toString().toLowerCase();
        const name = (data.name || '').toString().toLowerCase();
        if (slug) m[slug] = percent;
        if (name) m[name] = percent;
      });
      setMap(m);
    }, () => setMap({}));
    return () => unsub && unsub();
  }, []);

  const api = useMemo(() => ({
    map,
    getFor: (key) => {
      if (!key) return 0;
      const k = key.toString().toLowerCase();
      return Number(map[k]) || 0;
    }
  }), [map]);

  return (
    <DiscountContext.Provider value={api}>
      {children}
    </DiscountContext.Provider>
  );
}

export function useDiscounts() {
  return useContext(DiscountContext);
}
