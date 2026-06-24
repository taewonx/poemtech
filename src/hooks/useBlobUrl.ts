import { useCallback, useEffect, useState } from 'react';

export function useBlobUrl() {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      throw new Error('비디오 파일만 업로드할 수 있습니다.');
    }
    const url = URL.createObjectURL(file);
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setFileName(file.name);
  }, []);

  const clear = useCallback(() => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFileName(null);
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return { blobUrl, fileName, loadFile, clear };
}
