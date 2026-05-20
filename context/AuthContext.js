import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../utils/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from 'firebase/auth';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/utils/firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const router = useRouter();

  // Pantau status login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        if (!u.emailVerified) setNeedsEmailVerification(true);
        else setNeedsEmailVerification(false);

        // Sync Firestore flag jika user sudah verified tapi doc masih false
        try {
          const ref = doc(firestore, 'users', u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const d = snap.data();
            if (u.emailVerified && d.emailVerified === false) {
              await updateDoc(ref, { emailVerified: true });
            }
          }
        } catch (_) {}
      } else {
        setNeedsEmailVerification(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!needsEmailVerification) return;
    const whitelist = ['/please-verify', '/logout', '/', '/login']; // tambah /login
    if (typeof window !== 'undefined' && !whitelist.includes(router.pathname)) {
      router.replace('/please-verify');
    }
  }, [needsEmailVerification, router]);

  // Fungsi login
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Fungsi register
  const register = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  // Fungsi logout
  const logout = () => {
    return signOut(auth);
  };

  const value = {
    user,
    loading,
    needsEmailVerification,
    login,
    register,
    logout,
    resendVerification: async () => {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser);
        return true;
      }
      return false;
    },
    refreshUser: async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        return auth.currentUser.emailVerified;
      }
      return false;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook custom untuk akses context
export function useAuth() {
  return useContext(AuthContext);
}
