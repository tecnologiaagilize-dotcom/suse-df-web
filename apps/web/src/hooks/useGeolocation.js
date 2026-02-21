import { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const useGeolocation = (options = { enableHighAccuracy: true }) => {
    const [position, setPosition] = useState(null);
    const [error, setError] = useState(null);
    const watchIdRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const startWatching = async () => {
            try {
                // Solicitar Permissões (Híbrido)
                if (Capacitor.isNativePlatform()) {
                    const permission = await Geolocation.checkPermissions();
                    if (permission.location !== 'granted') {
                        await Geolocation.requestPermissions();
                    }
                }

                // Iniciar Watch
                if (Capacitor.isNativePlatform()) {
                    // MODO NATIVO (Capacitor)
                    watchIdRef.current = await Geolocation.watchPosition(options, (pos, err) => {
                        if (!isMounted) return;
                        if (err) {
                            console.error("[Geo-Native] Error:", err);
                            setError(err);
                            return;
                        }
                        if (pos) {
                            const { latitude, longitude, accuracy, speed, heading } = pos.coords;
                            setPosition({ latitude, longitude, accuracy, speed, heading, timestamp: pos.timestamp });
                        }
                    });
                } else {
                    // MODO WEB (Navegador)
                    if (!navigator.geolocation) {
                        setError(new Error("Geolocation not supported"));
                        return;
                    }

                    watchIdRef.current = navigator.geolocation.watchPosition(
                        (pos) => {
                            if (!isMounted) return;
                            const { latitude, longitude, accuracy, speed, heading } = pos.coords;
                            setPosition({ latitude, longitude, accuracy, speed, heading, timestamp: pos.timestamp });
                        },
                        (err) => {
                            if (!isMounted) return;
                            console.error("[Geo-Web] Error:", err);
                            setError(err);
                        },
                        options
                    );
                }
            } catch (err) {
                console.error("[Geo] Setup Error:", err);
                setError(err);
            }
        };

        startWatching();

        return () => {
            isMounted = false;
            if (watchIdRef.current !== null) {
                if (Capacitor.isNativePlatform()) {
                    Geolocation.clearWatch({ id: watchIdRef.current });
                } else {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                }
            }
        };
    }, []);

    return { position, error };
};
