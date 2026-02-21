import React, { useState } from 'react';
import { Activity, Zap, Volume2, Shield, Navigation, AlertCircle, Minimize2, Maximize2, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function IraDebugPanel({ data }) {
    const [isVisible, setIsVisible] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);

    if (!data || !isVisible) return null;

    const { score, status, features, context, debug } = data;
    
    // Cores baseadas no status
    const statusColors = {
        'NORMAL': 'bg-gray-100 text-gray-800 border-gray-300',
        'ATENCAO': 'bg-yellow-50 text-yellow-800 border-yellow-300',
        'RISCO': 'bg-orange-50 text-orange-800 border-orange-300',
        'EMERGENCIA': 'bg-red-50 text-red-800 border-red-300 animate-pulse'
    };

    const headerColor = {
        'NORMAL': 'bg-gray-100',
        'ATENCAO': 'bg-yellow-100',
        'RISCO': 'bg-orange-100',
        'EMERGENCIA': 'bg-red-600 text-white'
    };

    return (
        <div className={`fixed bottom-24 right-4 z-50 transition-all duration-300 shadow-2xl rounded-lg overflow-hidden border ${isMinimized ? 'w-64' : 'w-80'} ${statusColors[status] || 'bg-white border-gray-200'}`}>
            
            {/* Barra de Título / Header */}
            <div className={`flex justify-between items-center p-2 cursor-pointer ${headerColor[status] || 'bg-gray-100'} border-b border-black/10`}
                 onClick={() => setIsMinimized(!isMinimized)}
            >
                <h3 className="font-bold flex items-center gap-2 text-xs">
                    <Shield size={14} className={status === 'EMERGENCIA' ? 'text-white' : 'text-blue-600'}/>
                    IRA-SUSI™ v1.3
                </h3>
                
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title={isMinimized ? "Expandir" : "Minimizar"}
                    >
                        {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button 
                        onClick={() => setIsVisible(false)}
                        className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors"
                        title="Fechar Monitor"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Conteúdo do Monitor (Oculto se minimizado) */}
            {!isMinimized && (
                <div className="p-3 bg-white/95 backdrop-blur space-y-3 text-xs font-mono">
                    
                    {/* Status Badge */}
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-bold">STATUS ATUAL</span>
                        <span className={`px-2 py-0.5 rounded font-bold border ${statusColors[status]}`}>
                            {status}
                        </span>
                    </div>

                    {/* Score Principal */}
                    <div>
                        <div className="flex justify-between mb-1">
                            <span>Risco Acústico</span>
                            <span className="font-bold">{(score || 0).toFixed(3)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className={`h-2 rounded-full transition-all duration-200 ${
                                    score > 0.85 ? 'bg-red-600' : score > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                                }`} 
                                style={{ width: `${Math.min(100, (score || 0) * 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Features Acústicas */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 p-2 rounded border border-gray-200">
                            <div className="flex items-center gap-1 text-gray-500 mb-1">
                                <Volume2 size={12}/> RMS
                            </div>
                            <div className="font-bold text-base">{(features?.rms || 0).toFixed(3)}</div>
                            <div className="text-[9px] text-gray-400">Base: {(debug?.baseline || 0).toFixed(3)}</div>
                        </div>
                        
                        <div className="bg-gray-50 p-2 rounded border border-gray-200">
                            <div className="flex items-center gap-1 text-gray-500 mb-1">
                                <Zap size={12}/> Brilho
                            </div>
                            <div className="font-bold text-base">{(features?.spectralCentroid || 0).toFixed(0)}</div>
                            <div className="text-[9px] text-gray-400">Hz</div>
                        </div>
                    </div>

                    {/* Contexto Físico (Fase 2) */}
                    {context && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                            <div className={`p-2 rounded border flex flex-col justify-center ${context.impactDetected ? 'bg-red-100 border-red-300 animate-pulse' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center gap-1 text-gray-500 mb-1">
                                    <AlertCircle size={12}/> Impacto
                                </div>
                                <div className={`font-bold text-center ${context.impactDetected ? 'text-red-600' : 'text-gray-400'}`}>
                                    {context.impactDetected ? 'SIM' : 'NÃO'}
                                </div>
                            </div>

                            <div className="bg-gray-50 p-2 rounded border border-gray-200">
                                <div className="flex items-center gap-1 text-gray-500 mb-1">
                                    <Navigation size={12}/> Vel.
                                </div>
                                <div className="font-bold text-base">{(context.speed || 0).toFixed(0)} <span className="text-[9px] font-normal">km/h</span></div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Minimized View Info */}
            {isMinimized && (
                <div className="px-3 py-1 flex justify-between items-center text-[10px] bg-white">
                    <span className="font-bold">Risco: {(score || 0).toFixed(2)}</span>
                    <span className={status === 'EMERGENCIA' ? 'text-red-600 font-bold' : 'text-gray-500'}>{status}</span>
                </div>
            )}
        </div>
    );
}
