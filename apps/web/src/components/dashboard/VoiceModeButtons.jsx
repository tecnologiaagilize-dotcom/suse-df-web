import React from 'react';
import { Mic, MicOff, Activity } from 'lucide-react';

export const VoiceModeButtons = ({ currentMode, setMode }) => {
  // currentMode: 'OFF' | 'AUTO' | 'ACTIVE'

  return (
    <div className="w-full flex justify-between gap-2 mb-4 px-1">
      
      {/* 1. MONITORAMENTO AUTOMÁTICO (AZUL) */}
      <button
        onClick={() => setMode('AUTO')}
        className={`
          flex-1 relative overflow-hidden rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all duration-300
          ${currentMode === 'AUTO' 
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg scale-105 border-2 border-blue-300' 
            : 'bg-gradient-to-br from-blue-500/80 to-blue-600/80 shadow opacity-70 hover:opacity-100'
          }
          h-28
        `}
      >
        <div className="mb-1 p-2 bg-white/20 rounded-full relative">
           <Mic className="text-white w-6 h-6" />
           {currentMode === 'AUTO' && (
               <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-30"></div>
           )}
        </div>
        <span className="text-white font-bold text-xs leading-tight mb-1">
          Monitoramento<br/>Automático
        </span>
        <span className="text-[9px] text-blue-100 leading-tight">
          Aguardando<br/>palavra-chave
        </span>
      </button>

      {/* 2. MICROFONE ATIVO (VERDE) */}
      <button
        onClick={() => setMode('ACTIVE')}
        className={`
          flex-1 relative overflow-hidden rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all duration-300
          ${currentMode === 'ACTIVE' 
            ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg scale-105 border-2 border-green-300' 
            : 'bg-gradient-to-br from-green-500/80 to-green-600/80 shadow opacity-70 hover:opacity-100'
          }
          h-28
        `}
      >
        <div className="mb-1 p-2 bg-white/20 rounded-full flex items-center justify-center gap-1">
           {currentMode === 'ACTIVE' && <Activity className="text-white w-3 h-3 animate-pulse" />}
           <Mic className="text-white w-6 h-6" />
           {currentMode === 'ACTIVE' && <Activity className="text-white w-3 h-3 animate-pulse" />}
        </div>
        <span className="text-white font-bold text-xs leading-tight mb-1">
          Microfone<br/>Ativo
        </span>
        <span className="text-[9px] text-green-100 leading-tight">
          Captando<br/>áudio ambiente
        </span>
      </button>

      {/* 3. MICROFONE DESLIGADO (CINZA/PRATA) */}
      <button
        onClick={() => setMode('OFF')}
        className={`
          flex-1 relative overflow-hidden rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all duration-300
          ${currentMode === 'OFF' 
            ? 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-lg scale-105 border-2 border-gray-200' 
            : 'bg-gradient-to-br from-gray-200 to-gray-300 shadow opacity-70 hover:opacity-100'
          }
          h-28
        `}
      >
        <div className="mb-1 p-2 bg-white/40 rounded-full">
           <MicOff className="text-gray-600 w-6 h-6" />
        </div>
        <span className="text-gray-700 font-bold text-xs leading-tight mb-1">
          Microfone<br/>Desligado
        </span>
        <span className="text-[9px] text-gray-500 leading-tight">
          Toque para<br/>ativar
        </span>
      </button>

    </div>
  );
};
