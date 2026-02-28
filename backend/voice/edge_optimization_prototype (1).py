import numpy as np

class EdgeOptimizationPrototype:
    """
    Protótipo de otimizações de borda para o IRA-SUSE.
    Focado em VAD (Voice Activity Detection) e Otimização de Bitrate.
    """
    
    def __init__(self):
        self.silence_threshold = 0.01
        self.emergency_bitrate = 8000  # 8 kbps para emergência extrema
        self.normal_bitrate = 32000    # 32 kbps para áudio padrão

    def voice_activity_detection(self, audio_frame):
        """
        Simula VAD local para evitar envio de silêncio.
        Retorna True se houver voz ativa.
        """
        rms = np.sqrt(np.mean(np.square(audio_frame)))
        return rms > self.silence_threshold

    def adjust_bitrate_by_signal(self, signal_strength):
        """
        Ajusta dinamicamente o bitrate do Opus com base no sinal (0-100).
        """
        if signal_strength < 20:
            return self.emergency_bitrate
        elif signal_strength < 50:
            return 16000
        else:
            return self.normal_bitrate

    def simulate_pre_roll_buffer(self, buffer_size_sec=30, sample_rate=16000):
        """
        Simula um buffer circular de pré-roll em memória.
        """
        buffer_len = buffer_size_sec * sample_rate
        circular_buffer = np.zeros(buffer_len)
        return f"Buffer circular de {buffer_size_sec}s inicializado em RAM."

# Exemplo de uso do protótipo
if __name__ == "__main__":
    edge = EdgeOptimizationPrototype()
    
    # Simulação de áudio (silêncio vs voz)
    silence_frame = np.random.normal(0, 0.001, 1024)
    voice_frame = np.random.normal(0, 0.05, 1024)
    
    print(f"Voz detectada (Silêncio): {edge.voice_activity_detection(silence_frame)}")
    print(f"Voz detectada (Fala): {edge.voice_activity_detection(voice_frame)}")
    
    # Ajuste de Bitrate
    print(f"Bitrate sugerido (Sinal 15%): {edge.adjust_bitrate_by_signal(15)} bps")
    print(f"Bitrate sugerido (Sinal 80%): {edge.adjust_bitrate_by_signal(80)} bps")
