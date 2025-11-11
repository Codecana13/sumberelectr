import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth } from '@/utils/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/utils/firebase';
import { sendEmailVerification } from 'firebase/auth';

export default function PleaseVerify() {
  const router = useRouter();
  const emailQS = router.query.email || auth.currentUser?.email || '';
  const [status, setStatus] = useState(router.query.sent ? 'Email verifikasi telah dikirim.' : '');
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  // Restore state dari localStorage saat mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('verifyResendMeta');
      if (raw) {
        const meta = JSON.parse(raw);
        if (meta && typeof meta === 'object') {
          setResendCount(meta.count || 0);
          // Hitung sisa cooldown jika masih berlaku
            if (meta.last && meta.cooldown) {
              const elapsed = Math.floor((Date.now() - meta.last) / 1000);
              const remain = meta.cooldown - elapsed;
              if (remain > 0) setCooldown(remain);
            }
        }
      }
    } catch (_) {}
  }, []);

  // Countdown cooldown (lebih aman pakai interval)
  useEffect(() => {
    if (cooldown <= 0) return;
    const iv = setInterval(() => {
      setCooldown(c => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(iv);
  }, [cooldown]);

  const persistMeta = (count, cdSeconds) => {
    try {
      localStorage.setItem('verifyResendMeta', JSON.stringify({
        count,
        cooldown: cdSeconds,
        last: Date.now()
      }));
    } catch (_) {}
  };

  const computeNextCooldown = (nextCount) => {
    if (nextCount === 1) return 30;      // resend pertama
    if (nextCount === 2) return 60;      // resend kedua
    if (nextCount === 3) return 300;     // resend ketiga
    if (nextCount > 5) return 3600;      // lebih dari 5
    return 300;                          // ke-4 & ke-5
  };

  const resend = async () => {
    if (!auth.currentUser || auth.currentUser.emailVerified) return;
    if (cooldown > 0) return;
    const nextCount = resendCount + 1;
    const nextCd = computeNextCooldown(nextCount);
    try {
      await sendEmailVerification(auth.currentUser);
      setStatus(`Email verifikasi dikirim ulang (percobaan ${nextCount}).`);
      setResendCount(nextCount);
      setCooldown(nextCd);
      persistMeta(nextCount, nextCd);
    } catch (e) {
      setStatus('Gagal kirim ulang: ' + (e.message || 'error'));
    }
  };

  const checkVerified = async () => {
    if (!auth.currentUser) return;
    setChecking(true);
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      try {
        const ref = doc(firestore, 'users', auth.currentUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().emailVerified === false) {
          await updateDoc(ref, { emailVerified: true });
        }
      } catch (_) {}
      setStatus('Email sudah terverifikasi. Mengarahkan...');
      router.replace('/account');
    } else {
      setStatus('Belum terverifikasi. Cek inbox / spam.');
    }
    setChecking(false);
  };

  const backToLogin = async () => {
    try {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await auth.signOut();
      }
    } catch (_) {}
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-lg w-full text-center border border-red-100 shadow-xl rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-primary mb-4">Verifikasi Email Anda</h1>
        <p className="text-gray-700 mb-4">
          Link verifikasi telah dikirim ke <strong>{emailQS}</strong>. Silakan buka email dan klik link verifikasi.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Tidak menerima email? Periksa folder spam atau kirim ulang (batas eskalasi waktu berlaku).
        </p>

        {status && <div className="text-sm mb-4 text-primary">{status}</div>}

        <div className="text-xs text-gray-500 mb-3">
          Percobaan kirim ulang: {resendCount} {resendCount > 5 && '(dibatasi, tunggu 1 jam)'}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={resend}
            disabled={cooldown > 0}
            className="bg-primary text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-60"
          >
            {cooldown > 0 ? `Tunggu ${cooldown}s` : 'Kirim Ulang Email'}
          </button>
          <button
            onClick={checkVerified}
            className="border border-primary text-primary px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/5"
          >
            {checking ? 'Memeriksa...' : 'Saya Sudah Verifikasi'}
          </button>
          <button
            onClick={backToLogin}
            className="text-sm text-gray-500 underline mt-2"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    </div>
  );
}
