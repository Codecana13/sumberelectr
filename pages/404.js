import React, { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useRouter } from 'next/router';

export default function NotFoundPage() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/');
    }, 3000);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Head>
        <title>Halaman tidak ditemukan • 404</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Navbar />
      <main className="flex-1 pt-20 pb-10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white border border-red-100 rounded-2xl shadow-md p-8 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-600 text-2xl">🐟</div>
            <h1 className="text-2xl font-extrabold text-red-700 mb-2">Halaman Tidak Ditemukan</h1>
            <p className="text-gray-600 mb-6" aria-live="polite">Maaf, tautan yang Anda buka tidak tersedia atau sudah dipindahkan. Mengalihkan ke beranda dalam 3 detik...</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/" className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">Kembali ke Beranda</Link>
              <button
                type="button"
                onClick={() => (typeof window !== 'undefined' ? window.history.back() : null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
