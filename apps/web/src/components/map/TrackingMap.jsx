import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { supabase } from '../../lib/supabase';
import L from 'leaflet';

// Corrigir ícone padrão do Leaflet (Problema comum com Webpack/Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Componente para lidar com redimensionamento e centralização
function MapController({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  useEffect(() => {
    // Forçar atualização do tamanho do mapa quando o componente monta ou redimensiona
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    
    const container = map.getContainer();
    if (container) {
        resizeObserver.observe(container);
    }

    // Fallback inicial
    setTimeout(() => {
        map.invalidateSize();
    }, 100);

    return () => {
        resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}

const defaultCenter = [-15.793889, -47.882778]; // Brasília (Leaflet usa [lat, lng])

function TrackingMap({ lat, lng, alertId }) {
  const [routePath, setRoutePath] = useState([]);
  
  // Garantir coordenadas válidas
  const center = (lat && lng) ? [Number(lat), Number(lng)] : defaultCenter;

  // Buscar histórico de rota
  useEffect(() => {
      if (!alertId) return;

      const fetchRoute = async () => {
          const { data, error } = await supabase
              .from('location_updates')
              .select('latitude, longitude')
              .eq('alert_id', alertId)
              .order('recorded_at', { ascending: true });

          if (data) {
              // Leaflet usa array [lat, lng]
              const path = data.map(p => [p.latitude, p.longitude]);
              setRoutePath(path);
          }
      };

      fetchRoute();
  }, [alertId]);

  // Atualizar a rota localmente
  useEffect(() => {
      if (lat && lng) {
          setRoutePath(prev => {
              const last = prev[prev.length - 1];
              // Evitar duplicados (comparação simples)
              if (last && last[0] === lat && last[1] === lng) return prev;
              return [...prev, [Number(lat), Number(lng)]];
          });
      }
  }, [lat, lng]);

  return (
    <div className="w-full h-full relative z-0">
        <MapContainer 
            center={center} 
            zoom={15} 
            style={{ width: '100%', height: '100%', minHeight: '100%' }}
            scrollWheelZoom={true}
            className="h-full w-full"
        >
            <MapController center={center} />
            
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Marcador da Posição Atual */}
            <Marker position={center}>
                <Popup>
                    Viatura / Motorista <br />
                    Lat: {lat?.toFixed(5)} <br />
                    Lng: {lng?.toFixed(5)}
                </Popup>
            </Marker>

            {/* Rota (Polyline) */}
            {routePath.length > 1 && (
                <Polyline 
                    positions={routePath} 
                    pathOptions={{ color: 'red', weight: 4, opacity: 0.8 }} 
                />
            )}
        </MapContainer>
    </div>
  );
}

export default React.memo(TrackingMap);
