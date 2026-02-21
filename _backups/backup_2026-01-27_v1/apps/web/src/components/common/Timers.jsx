import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const formatDuration = (ms) => {
  if (ms < 0) ms = 0;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Componente que conta o tempo progressivamente
export const ProgressiveTimer = ({ startTime, label, icon: Icon, colorClass = "text-gray-700" }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    
    const start = new Date(startTime).getTime();
    
    // Atualiza imediatamente
    setElapsed(Date.now() - start);

    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className={`flex items-center gap-1 font-mono text-sm ${colorClass}`}>
      {Icon && <Icon size={14} />}
      {label && <span className="mr-1">{label}:</span>}
      <span className="font-bold">{formatDuration(elapsed)}</span>
    </div>
  );
};

// Componente que mostra um tempo estático (diferença fixa entre inicio e fim)
export const StaticDuration = ({ start, end, label, icon: Icon, colorClass = "text-gray-700" }) => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  
  return (
    <div className={`flex items-center gap-1 font-mono text-sm ${colorClass}`}>
      {Icon && <Icon size={14} />}
      {label && <span className="mr-1">{label}:</span>}
      <span className="font-bold">{formatDuration(diff)}</span>
    </div>
  );
};
