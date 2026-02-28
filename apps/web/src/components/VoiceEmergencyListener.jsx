// VoiceEmergencyListener.jsx - Atualizado com Lógica IRA-SUSI
// Integração do Modelo Matemático de Risco Acústico

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { IraSusiMath } from '../services/audio/ira/IraSusiMath';

const VoiceEmergencyListener = () => {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [riskScore, setRiskScore] = useState(0); // IRA Score (0-1)
  const [riskLevel, setRiskLevel] = useState('NORMAL'); // NORMAL, ATENCAO, RISCO, EMERGENCIA
  
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const iraMathRef = useRef(new IraSusiMath());
  const historyRef = useRef([]); // Histórico de IRA Scores para estabilização

  // Thresholds dinâmicos (v1.0 - Indoor)
  const THRESHOLDS = {
    ATENCAO: 0.50, // θ1
    RISCO: 0.66,   // θ2
    EMERGENCIA: 0.82 // θ3
  };

  useEffect(() => {
    if (user) {
      startListening();
    }
    return () => stopListening();
  }, [user]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      await audioContextRef.current.audioWorklet.addModule('/workers/ira-audio-processor.js');
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'ira-audio-processor');
      
      workletNodeRef.current.port.onmessage = (event) => {
        if (event.data.type === 'IRA_FEATURES') {
          processFeatures(event.data.features);
        }
      };

      source.connect(workletNodeRef.current);
      workletNodeRef.current.connect(audioContextRef.current.destination); // Mudo (processamento apenas)
      
      setIsListening(true);
      console.log('IRA-SUSI Listener Active');
    } catch (err) {
      console.error('Erro ao iniciar IRA Listener:', err);
    }
  };

  const processFeatures = (features) => {
    const ira = iraMathRef.current.computeIRA(features);
    
    // Estabilização Temporal (Média Móvel Exponencial)
    // IRA_hat_t = 0.85 * IRA_hat_{t-1} + 0.15 * IRA_t
    const prevIra = historyRef.current.length > 0 ? historyRef.current[historyRef.current.length - 1] : 0;
    const iraHat = 0.85 * prevIra + 0.15 * ira.ira;
    
    historyRef.current.push(iraHat);
    if (historyRef.current.length > 50) historyRef.current.shift(); // Manter janela curta

    setRiskScore(iraHat);
    evaluateRiskLevel(iraHat);
    
    // Atualizar baseline se estiver NORMAL
    if (riskLevel === 'NORMAL') {
      iraMathRef.current.updateBaseline('energy', features.energy, true);
      iraMathRef.current.updateBaseline('pitch', features.pitch, true);
    }
  };

  const evaluateRiskLevel = (score) => {
    let newLevel = 'NORMAL';
    if (score >= THRESHOLDS.EMERGENCIA) newLevel = 'EMERGENCIA';
    else if (score >= THRESHOLDS.RISCO) newLevel = 'RISCO';
    else if (score >= THRESHOLDS.ATENCAO) newLevel = 'ATENCAO';

    if (newLevel !== riskLevel) {
      setRiskLevel(newLevel);
      if (newLevel === 'EMERGENCIA') {
        triggerEmergency('voice_ira_high_score', score);
      }
    }
  };

  const triggerEmergency = async (type, score) => {
    console.warn(`EMERGÊNCIA DETECTADA: ${type} (Score: ${score.toFixed(2)})`);
    // Aqui chamaria o serviço de SOS real
    // await sosService.createEvent({ ... })
  };

  const stopListening = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsListening(false);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white p-2 rounded shadow-lg text-xs z-50 opacity-80 hover:opacity-100">
      <div className="font-bold mb-1">IRA-SUSI Monitor</div>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span>{riskLevel}</span>
      </div>
      <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
        <div 
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
          style={{ width: `${Math.min(riskScore * 100, 100)}%` }}
        ></div>
      </div>
      <div className="text-[10px] text-gray-500 mt-1">Score: {riskScore.toFixed(3)}</div>
    </div>
  );
};

export default VoiceEmergencyListener;
