import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Clock, ShieldCheck, Car, User, AlertTriangle } from 'lucide-react';
import TrackingMap from '../../components/map/TrackingMap';

export default function SharedAlert() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLocation = async () => {
    try {
      const { data: result, error } = await supabase
        .rpc('get_shared_alert_data', { p_token: token });

      if (error) throw error;
      
      // Se retornou null ou valid=false
      if (!result || !result.valid) {
          setError(true);
          return;
      }
      
      setData(result);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
    const interval = setInterval(fetchLocation, 5000); // Polling a cada 5s
    return () => clearInterval(interval);
  }, [token]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Carregando dados seguros...</div>;
  if (error) return <div className="flex h-screen items-center justify-center bg-gray-900 text-red-500 font-bold">Link inválido ou expirado.</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header Seguro */}
      <header className="bg-red-700 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
            <ShieldCheck size={24} />
            <div>
                <h1 className="font-bold text-sm uppercase">Acesso Policial</h1>
                <p className="text-[10px] opacity-80">Link Dinâmico Monitorado</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-xs font-bold">AO VIVO</span>
        </div>
      </header>

      <div className="flex-1 relative">
         <TrackingMap lat={data.current_lat} lng={data.current_lng} />
         
         {/* Card Flutuante com Dados */}
         <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-lg shadow-2xl p-4 border-l-4 border-red-600 max-w-md mx-auto">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="bg-gray-200 p-2 rounded-full">
                        <User size={20} className="text-gray-700" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900">{data.driver_name}</h2>
                        {/* Telefone removido por privacidade na view pública, a menos que RPC retorne */}
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                        data.status === 'active' ? 'bg-red-100 text-red-600' : 
                        data.status === 'investigating' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                    }`}>
                        {data.status}
                    </span>
                </div>
            </div>

            <div className="bg-gray-50 p-3 rounded border border-gray-200 flex items-center gap-3">
                <Car size={20} className="text-gray-600" />
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Veículo</p>
                    <p className="text-sm font-medium text-gray-800">
                        {data.car_brand} {data.car_model || 'Modelo N/A'}
                    </p>
                    <p className="text-xs text-gray-600">
                        {data.car_plate || 'Placa N/A'} • {data.car_color || 'Cor N/A'}
                    </p>
                </div>
            </div>

            <div className="mt-3 flex justify-between items-center text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                    <Clock size={10} /> 
                    Atualizado: {new Date(data.last_update).toLocaleTimeString()}
                </span>
                <span>ID: {data.alert_id.slice(0,8)}</span>
            </div>
         </div>
      </div>
    </div>
  );
}
