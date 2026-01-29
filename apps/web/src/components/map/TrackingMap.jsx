import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React Leaflet
// Importando imagens diretamente dos node_modules ou public
// Em Vite, isso pode precisar de ajuste, mas vamos tentar o padrão
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Componente auxiliar para atualizar o centro do mapa quando props mudam
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const TrackingMap = ({ lat, lng }) => {
  // Coordenadas padrão (Brasília) se não fornecidas
  const hasLocation = lat !== undefined && lng !== undefined && lat !== null && lng !== null;
  const position = hasLocation ? [Number(lat), Number(lng)] : [-15.793889, -47.882778];

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={position} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <ChangeView center={position} zoom={15} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasLocation && (
            <Marker position={position}>
            <Popup>
                Motorista
            </Popup>
            </Marker>
        )}
      </MapContainer>
      
      {!hasLocation && (
          <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs z-[1000] shadow">
              Aguardando localização...
          </div>
      )}
    </div>
  );
};

export default React.memo(TrackingMap);
