import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: -15.793889,
  lng: -47.882778
};

function TrackingMap({ lat, lng }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    // Tenta pegar a chave do ambiente ou usa string vazia (vai dar erro de API Key se não configurar)
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const [map, setMap] = useState(null);

  const onLoad = useCallback(function callback(map) {
    // const bounds = new window.google.maps.LatLngBounds(center);
    // map.fitBounds(bounds);
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map) {
    setMap(null);
  }, []);

  // Se não houver chave configurada, mostra aviso
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500">
              <p className="font-bold text-red-500">Google Maps API Key não configurada.</p>
              <p className="text-sm">Adicione VITE_GOOGLE_MAPS_API_KEY no arquivo .env</p>
              <p className="text-xs mt-2">Lat: {lat} | Lng: {lng}</p>
          </div>
      );
  }

  if (loadError) {
    return <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500">Erro ao carregar o mapa.</div>;
  }

  if (!isLoaded) {
    return <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-500">Carregando Mapa...</div>;
  }

  const center = (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : defaultCenter;

  return (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Marcador da Posição Atual */}
        <Marker 
            position={center}
            title="Motorista"
            // icon="http://maps.google.com/mapfiles/kml/pal4/icon54.png" // Ícone de alerta opcional
        />
      </GoogleMap>
  );
}

export default React.memo(TrackingMap);
