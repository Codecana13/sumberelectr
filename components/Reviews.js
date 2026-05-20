import { useEffect, useState, useRef } from 'react';

export default function Reviews({ productId, max = 10 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true); // mobile: show only first visible chunk but allow swipe/scroll
  const containerRef = useRef(null);

  // deterministic pastel color from string (keeps same user color across renders)
  const pastelColorFromString = (str) => {
    if (!str) str = 'default';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    const h = Math.abs(hash) % 360; // hue
    const s = 60; // saturation
    const l = 82; // lightness (pastel)
    const borderL = 72;
    return {
      bg: `hsl(${h} ${s}% ${l}%)`,
      border: `hsl(${h} ${Math.max(40, s - 10)}% ${borderL}%)`
    };
  };

  const maskName = (name) => {
    if (!name) return 'Pembeli';
    const s = String(name).trim();
    if (s.length <= 2) return s[0] + '*';
    const middle = s.slice(1, -1).replace(/./g, '*');
    return `${s[0]}${middle}${s.slice(-1)}`;
  };

  useEffect(() => {
    if (!productId) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/debug-reviews?productId=${encodeURIComponent(String(productId))}`);
        if (!res.ok) throw new Error('failed');
        const body = await res.json();
        const items = (Array.isArray(body.items) ? body.items : []).map(d => {
          const rd = d || {};
          let created = null;
          if (rd.createdAt && typeof rd.createdAt === 'object' && rd.createdAt._seconds) {
            created = new Date(rd.createdAt._seconds * 1000 + Math.round((rd.createdAt._nanoseconds || 0) / 1000000)).toISOString();
          } else if (rd.createdAt && typeof rd.createdAt === 'string') {
            created = rd.createdAt;
          }
          return {
            id: rd.id || '',
            name: rd.name || 'Pembeli',
            comment: rd.comment || '',
            rating: rd.rating || 0,
            createdAt: created
          };
        });
  items.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
  const limited = items.slice(0, Number(max) || 10);
  if (mounted) setReviews(limited);
      } catch (err) {
        if (mounted) setReviews([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [productId, max]);

  if (loading) return (
    <div className="mt-4 text-sm text-gray-500">Memuat ulasan...</div>
  );

  if (!reviews || reviews.length === 0) return (
    <div className="mt-4 text-sm text-gray-500">Belum ada ulasan untuk produk ini.</div>
  );

  return (
    <section className="mt-6 lg:mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Ulasan Teratas</h2>
      </div>

      {/*
        Layout notes:
        - Desktop (lg+): render all up to `max` (default 10).
        - Mobile: start collapsed showing a scrollable area sized to approximately 3 items; user can swipe/scroll to see more up to `max`.
        - A centered "Tampilkan Semua" control (mobile-only) will expand the container to show the full list.
      */}
      <div className="relative">
        <div
          ref={containerRef}
          className={
            `space-y-3 transition-all duration-300 ease-in-out ` +
            // collapsed max-height applied only on mobile; lg overrides to show all
            (collapsed ? 'max-h-[16rem] overflow-y-auto lg:max-h-none' : 'max-h-none')
          }
          aria-expanded={!collapsed}
        >
          {reviews.map((r) => (
          <article key={r.id} className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {(() => {
                  const clr = pastelColorFromString(r.name || 'pembeli');
                  const initial = r.name ? String(r.name).charAt(0).toUpperCase() : 'U';
                  return (
                    <div
                      className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-gray-800 font-semibold text-sm"
                      style={{ background: clr.bg, borderColor: clr.border }}
                      title={r.name || 'Pembeli'}
                    >
                      {initial}
                    </div>
                  );
                })()}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800" title={r.name}>{maskName(r.name)}</div>
                    <div className="text-xs text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : ''}</div>
                  </div>
                  <div className="text-sm text-yellow-500 font-semibold">{r.rating} ★</div>
                </div>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed break-words">{r.comment}</p>
              </div>
            </div>
          </article>
        ))}
        </div>

        {/* faded gradient to indicate more content when collapsed (mobile only) */}
        {collapsed && reviews.length > 3 && (
          <div className="pointer-events-none lg:hidden absolute left-0 right-0 bottom-12 h-12 bg-gradient-to-t from-white/90 to-transparent" />
        )}

        {/* mobile-only centered control to expand fully */}
        {collapsed && reviews.length > 3 && (
          <div className="mt-3 flex justify-center lg:hidden">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="text-sm text-primary font-medium underline"
            >
              Tampilkan Semua
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
