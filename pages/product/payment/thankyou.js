import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';

export default function ThankYouPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/account');
    }, 1300);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Image
        src="https://res.cloudinary.com/di2mbndau/image/upload/v1756139034/Pngtree_desain_simbol_terima_pesanan_8497439_ycnv4z.png"
        alt="Pesanan diterima"
        width={160}
        height={160}
        className="mb-6"
        priority
      />
      <h1 className="text-xl font-bold text-orange-600 mb-2">Terima Kasih!</h1>
      <p className="text-sm text-gray-700">Pesanan Anda telah diterima.</p>
    </div>
  );
}