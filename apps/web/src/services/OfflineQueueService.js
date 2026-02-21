import { supabase } from '../lib/supabase';

const OFFLINE_QUEUE_KEY = 'suse_offline_alerts';

const OfflineQueueService = {
  // Adiciona um alerta na fila
  enqueueAlert: (alertData) => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push({
      ...alertData,
      timestamp: Date.now(),
      retryCount: 0
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('[Offline] Alerta salvo na fila local:', alertData);
  },

  // Processa a fila (tenta enviar tudo)
  processQueue: async () => {
    if (!navigator.onLine) return;

    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`[Offline] Processando fila com ${queue.length} alertas pendentes...`);
    
    const remainingQueue = [];
    
    for (const item of queue) {
      try {
        console.log('[Offline] Tentando enviar alerta antigo:', item);
        
        // Tenta enviar usando a mesma RPC do dashboard
        const { data, error } = await supabase.rpc('trigger_emergency_rpc', {
          p_trigger_type: item.trigger_type,
          p_latitude: item.latitude,
          p_longitude: item.longitude,
          p_notes: item.notes + ' (Sincronizado Offline)'
        });

        if (error) throw error;
        
        console.log('[Offline] Alerta sincronizado com sucesso!', data);
        
        // Se sucesso, não adiciona no remainingQueue (remove da fila)
        
      } catch (err) {
        console.error('[Offline] Falha ao sincronizar item:', err);
        item.retryCount += 1;
        // Se falhou menos de 5 vezes, mantém na fila para tentar depois
        if (item.retryCount < 5) {
            remainingQueue.push(item);
        }
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
  },

  // Retorna se há itens na fila
  hasPendingItems: () => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    return queue.length > 0;
  }
};

export default OfflineQueueService;
