import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Redirect chat page to WhatsApp admin, optionally with product embed in message
export default function ChatRedirect() {
  const router = useRouter();
  useEffect(() => {
    const adminWa = '6281288886462';
    const { embed } = router.query || {};
    let msg = 'Halo Admin, saya butuh bantuan.';
    if (embed) {
      try {
        const p = JSON.parse(String(embed));
        const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
        const link = p?.slug ? `${site}/product/${p.slug}` : (typeof window !== 'undefined' ? window.location.origin : site);
        msg = `Halo Admin, saya ingin bertanya tentang produk: ${p?.name || ''}\nID: ${p?.id || ''}\nLink: ${link}`;
      } catch {}
    }
    const waUrl = `https://wa.me/${adminWa}?text=${encodeURIComponent(msg)}`;
    // open in same tab for a hard redirect
    window.location.replace(waUrl);
  }, [router.query]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-600">Mengalihkan ke WhatsApp…</p>
    </main>
  );
}
