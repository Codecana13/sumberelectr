import AdminLayout from '../_layout';

export default function AdminChatRemoved() {
  const waNumber = process.env.NEXT_PUBLIC_ADMIN_WA || '6281288886462';
  const waWebUrl = 'https://web.whatsapp.com/';
  
  return (
    <AdminLayout>
      <main className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold mb-4">Chat Dialihkan ke WhatsApp</h1>
        <p className="text-sm text-gray-600 mb-6">Fitur chat internal dinonaktifkan. Admin dapat membuka WhatsApp Web untuk scan QR, atau langsung membuka chat ke nomor utama.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href={waWebUrl}
            target="_blank"
            rel="noopener"
            className="inline-block px-5 py-3 rounded-lg bg-gray-700 text-white text-sm font-medium hover:bg-gray-800"
          >Buka WhatsApp Web</a>
          
        </div>
        <p className="text-xs text-gray-500 mt-5 leading-relaxed">
          Tips: Pastikan akun WhatsApp sudah tersambung (scan QR) pada tab Web. Jika berganti device, ulangi proses scan. Untuk rotasi CS silakan gunakan konfigurasi nomor di halaman Settings.
        </p>
      </main>
    </AdminLayout>
  );
}
