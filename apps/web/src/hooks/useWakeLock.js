import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWakeLock() {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = wakeLock;
        setIsLocked(true);
        console.log('[WakeLock] Ativado: Tela mantida ativa.');

        wakeLock.addEventListener('release', () => {
          console.log('[WakeLock] Liberado.');
          setIsLocked(false);
        });
      } catch (err) {
        console.error('[WakeLock] Erro ao ativar:', err);
      }
    } else {
        console.warn('[WakeLock] API não suportada neste navegador.');
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, []);

  // Reativar se o app voltar para foreground
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isLocked) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isLocked, requestWakeLock, releaseWakeLock]);

  return { isLocked, requestWakeLock, releaseWakeLock };
}
