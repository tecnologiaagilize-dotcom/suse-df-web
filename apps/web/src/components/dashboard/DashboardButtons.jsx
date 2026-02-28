import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Mic, Heart, User, MapPin, AlertTriangle, ShieldCheck, Activity, HeartPulse } from 'lucide-react';

// --- UTILS ---
// Hook customizado para lidar com Long Press vs Click
const useLongPress = (onLongPress, onClick, { shouldPreventDefault = true, delay = 3000 } = {}) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef();
  const target = useRef();

  const start = (event) => {
    if (shouldPreventDefault && event.target) {
      target.current = event.target;
    }
    timeout.current = setTimeout(() => {
      onLongPress(event);
      setLongPressTriggered(true);
    }, delay);
  };

  const clear = (event, shouldTriggerClick = true) => {
    timeout.current && clearTimeout(timeout.current);
    if (shouldTriggerClick && !longPressTriggered && onClick) {
      onClick(event);
    }
    setLongPressTriggered(false);
    target.current = undefined;
  };

  return {
    onMouseDown: (e) => start(e),
    onTouchStart: (e) => start(e),
    onMouseUp: (e) => clear(e),
    onMouseLeave: (e) => clear(e, false),
    onTouchEnd: (e) => clear(e)
  };
};

// --- COMPONENTS ---

// 1. Geofence Button
export const GeofenceButton = ({ status = 'CONFIGURED', onClick, onLongPress }) => {
  // status: 'CONFIGURED' (Blue) | 'ACTIVE' (Green)
  const isActive = status === 'ACTIVE';
  
  // Usando lógica interna para separar clique de long press
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef(null);
  const isLongPress = useRef(false);

  const handleStart = () => {
    setIsPressing(true);
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      if (onLongPress) onLongPress();
    }, 3000); // 3 segundos
  };

  const handleEnd = (e) => {
    setIsPressing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Se não foi long press, dispara o click normal
    if (!isLongPress.current) {
        if (onClick) onClick();
    }
  };

  return (
    <button
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onMouseLeave={() => {
         setIsPressing(false);
         if (timerRef.current) clearTimeout(timerRef.current);
      }}
      className={`
        w-full relative overflow-hidden rounded-[20px] p-4 flex items-center justify-between transition-all duration-300 shadow-lg select-none
        ${isActive 
          ? 'bg-gradient-to-br from-[#0F9D58] to-[#34C759] shadow-[0_8px_20px_rgba(15,157,88,0.40)]' 
          : 'bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] shadow-[0_8px_18px_rgba(30,58,138,0.35)]'
        }
        h-[72px] sm:h-[88px] active:scale-[0.98]
        ${isPressing && !isLongPress.current ? 'scale-[0.98]' : ''}
      `}
    >
      <div className="flex items-center gap-4 flex-1 pointer-events-none">
        <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm relative overflow-hidden">
          {isActive ? (
              <ShieldCheck className="text-white w-6 h-6 animate-random-move" />
          ) : (
              <MapPin className="text-white w-6 h-6 animate-random-move" />
          )}
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="text-white font-bold text-lg leading-tight">
            {isActive ? 'Cerca Virtual – ATIVADA' : 'Cerca Virtual'}
          </span>
          <span className={`text-sm leading-tight ${isActive ? 'text-white/90' : 'text-white/85'}`}>
            {isActive ? 'Monitoramento por cidades ativo' : 'Área configurada'}
          </span>
        </div>
      </div>
      <ChevronRight className="text-white w-6 h-6 pointer-events-none" />
      
      {/* Progress Bar for Long Press (Visual Feedback) */}
      {isPressing && !isLongPress.current && (
        <div className="absolute bottom-0 left-0 h-1 bg-white/50 transition-all duration-[3000ms] ease-linear w-full origin-left animate-progress-grow" />
      )}
      
      {/* Hint for Long Press */}
      <span className="absolute bottom-1 right-4 text-[9px] text-white/40 uppercase tracking-wider pointer-events-none">
        Segure 3s para editar
      </span>
    </button>
  );
};

// 2. Generic Menu Button (Cadastro, Voz, Saúde)
export const MenuButton = ({ 
  icon: Icon, 
  title, 
  subtitle, 
  onClick, 
  animationType = 'none' // 'none', 'voice-wave', 'heartbeat'
}) => {
  // Custom Icon for Profile with Face Animation
  const ProfileFaceIcon = () => (
      <div className="w-6 h-6 relative">
          {/* Base Face Circle */}
          <div className="w-full h-full rounded-full border-2 border-white bg-transparent flex items-center justify-center relative overflow-hidden">
              {/* Eyes Container - Moving */}
              <div className="absolute top-[30%] w-full flex justify-center gap-1 animate-face-eyes">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
              </div>
              {/* Mouth - Moving */}
              <div className="absolute bottom-[25%] w-2 h-[2px] bg-white rounded-full animate-face-mouth"></div>
          </div>
      </div>
  );

  return (
    <button
      onClick={onClick}
      className="
        w-full relative overflow-hidden rounded-[20px] p-4 flex items-center justify-between 
        bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] 
        shadow-[0_8px_18px_rgba(30,58,138,0.35)]
        h-[72px] sm:h-[88px] transition-all duration-300 active:scale-[0.98] group
      "
    >
      <div className="flex items-center gap-4 flex-1 z-10 pointer-events-none">
        <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm relative">
          {title === "Meu Cadastro" ? (
              <ProfileFaceIcon />
          ) : (
              <Icon className={`text-white w-6 h-6 ${animationType === 'heartbeat' ? 'animate-pulse-heart' : ''}`} />
          )}
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="text-white font-bold text-lg leading-tight">{title}</span>
          <span className="text-sm text-white/85 leading-tight">{subtitle}</span>
        </div>
      </div>
      <ChevronRight className="text-white w-6 h-6 z-10 pointer-events-none group-hover:translate-x-1 transition-transform" />

      {/* Background Animations */}
      {animationType === 'voice-wave' && (
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden flex items-center">
           <div className="w-full h-1 bg-white animate-voice-wave"></div>
        </div>
      )}
    </button>
  );
};

// 3. SOS Button (High Relief)
export const SOSButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="
        relative w-64 h-64 rounded-full flex flex-col items-center justify-center
        bg-gradient-to-b from-[#ff4d4d] to-[#cc0000]
        shadow-[0_10px_0_#990000,0_15px_20px_rgba(0,0,0,0.4),inset_0_2px_5px_rgba(255,255,255,0.5)]
        active:shadow-[0_4px_0_#990000,0_8px_10px_rgba(0,0,0,0.4),inset_0_2px_5px_rgba(255,255,255,0.5)]
        active:translate-y-1.5 transition-all duration-150
        border-4 border-[#ff6666]
        group
      "
    >
      <AlertTriangle className="h-24 w-24 text-white drop-shadow-md mb-2 group-active:scale-95 transition-transform" />
      <span className="text-4xl font-black text-white tracking-wider drop-shadow-md">SOS</span>
    </button>
  );
};

// --- CSS STYLES ---
export const DashboardStyles = () => (
  <style>{`
    @keyframes voice-wave {
      0% { transform: translateX(-100%) scaleY(1); opacity: 0; }
      50% { transform: translateX(0%) scaleY(4); opacity: 1; }
      100% { transform: translateX(100%) scaleY(1); opacity: 0; }
    }
    .animate-voice-wave {
      animation: voice-wave 2s ease-in-out infinite;
    }
    
    @keyframes pulse-heart {
      0% { transform: scale(1); }
      14% { transform: scale(1.3); }
      28% { transform: scale(1); }
      42% { transform: scale(1.3); }
      70% { transform: scale(1); }
    }
    .animate-pulse-heart {
      animation: pulse-heart 1.5s ease-in-out infinite;
    }

    @keyframes progress-grow {
        from { width: 0%; }
        to { width: 100%; }
    }
    .animate-progress-grow {
        animation: progress-grow 3s linear forwards;
    }

    @keyframes random-move {
        0%, 100% { transform: translate(0, 0); }
        25% { transform: translate(-2px, -3px); }
        50% { transform: translate(3px, 1px); }
        75% { transform: translate(-1px, 4px); }
    }
    .animate-random-move {
        animation: random-move 3s ease-in-out infinite;
    }

    @keyframes face-eyes {
        0%, 100% { transform: translate(0, 0); }
        25% { transform: translate(-2px, -1px); }
        50% { transform: translate(2px, 0); }
        75% { transform: translate(0, 2px); }
    }
    .animate-face-eyes {
        animation: face-eyes 4s ease-in-out infinite;
    }

    @keyframes face-mouth {
        0%, 100% { transform: scaleX(1) translateY(0); }
        50% { transform: scaleX(1.2) translateY(1px); }
    }
    .animate-face-mouth {
        animation: face-mouth 2s ease-in-out infinite;
    }
  `}</style>
);
