// /hooks/useStorage.js
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useState } from "react";
import { app } from "../utils/firebase"; // pastikan app Firebase sudah diinisialisasi

export function useStorage() {
  const storage = getStorage(app);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(null);

  const uploadFile = async (file, path) => {
    setUploading(true);
    try {
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      setUrl(downloadUrl);
      return downloadUrl;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, url, uploadFile };
}
