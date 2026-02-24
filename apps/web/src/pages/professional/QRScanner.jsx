import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrScanner } from '@yudiel/react-qr-scanner';
import { ArrowLeft, Camera, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function QRScannerPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);

  const handleScan = async (result) => {
    if (result) {
        setScanning(false);
        try {
            console.log("QR Lido:", result);
            // Extrair ID do URL se for um link completo
            // Ex: https://app.com/health/check/UUID
            let token = result;
            if (result.includes('/health/check/')) {
                token = result.split('/health/check/')[1];
            }

            // Validar Token e Iniciar Sessão (Mock por enquanto, depois RPC start_qr_session)
            // navigate(`/professional/patient/${token}`);
            alert(`Código lido: ${token}. Redirecionando para prontuário...`);
            
        } catch (err) {
            setError("Código inválido ou expirado.");
            setScanning(true);
        }
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <div className="bg-black/50 p-4 absolute top-0 w-full z-10 flex justify-between items-center text-white">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                <ArrowLeft size={24} />
            </button>
            <h1 className="font-bold text-lg">Escanear Paciente</h1>
            <div className="w-10"></div>
        </div>

        {/* Scanner Area */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {scanning ? (
                <div className="w-full h-full">
                    <QrScanner
                        onDecode={(result) => handleScan(result)}
                        onError={(error) => console.log(error?.message)}
                        containerStyle={{ width: '100%', height: '100%' }}
                        videoStyle={{ objectFit: 'cover' }}
                    />
                    
                    {/* Overlay Frame */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-2 border-blue-500 rounded-xl relative">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1"></div>
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1"></div>
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1"></div>
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-full h-0.5 bg-red-500/50 animate-scan-line"></div>
                            </div>
                        </div>
                    </div>
                    
                    <p className="absolute bottom-20 w-full text-center text-white/80 text-sm font-medium px-4">
                        Aponte a câmera para o QR Code da Carteira de Saúde do paciente
                    </p>
                </div>
            ) : (
                <div className="text-white text-center">
                    <p>Processando...</p>
                </div>
            )}
        </div>

        {error && (
            <div className="absolute bottom-10 left-4 right-4 bg-red-600 text-white p-4 rounded-lg flex items-center gap-3 shadow-lg animate-slide-up">
                <AlertTriangle size={24} />
                <p className="font-medium">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto p-1 bg-white/20 rounded">
                    OK
                </button>
            </div>
        )}
    </div>
  );
}