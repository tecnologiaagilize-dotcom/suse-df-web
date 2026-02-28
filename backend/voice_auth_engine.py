import numpy as np

class VoiceAuthEngine:
    """
    Motor de Biometria de Voz para o sistema IRA-SUSE.
    Implementa SpeakerMatch, Liveness e AntiReplay.
    """
    
    def __init__(self, threshold_similarity=0.75):
        self.threshold_similarity = threshold_similarity

    def calculate_cosine_similarity(self, embedding_a, embedding_b):
        """Calcula a similaridade de cosseno entre dois embeddings neurais."""
        dot_product = np.dot(embedding_a, embedding_b)
        norm_a = np.linalg.norm(embedding_a)
        norm_b = np.linalg.norm(embedding_b)
        return dot_product / (norm_a * norm_b)

    def check_liveness(self, audio_features):
        """
        Valida se a voz é humana (Liveness).
        Analisa HNR, microvariações (Jitter/Shimmer) e prosódia.
        """
        # Simulação de lógica baseada em thresholds de HNR e variabilidade de F0
        hnr_coerente = audio_features.get('hnr', 0) > 15  # dB
        prosodia_dinamica = audio_features.get('f0_std', 0) > 5  # Hz
        return hnr_coerente and prosodia_dinamica

    def check_anti_replay(self, spectral_data):
        """
        Detecta ataques de replay analisando artefatos espectrais.
        """
        # Simulação: verifica se há distorção harmônica total (THD) ou cortes de frequência
        high_freq_loss = spectral_data.get('high_freq_loss', False)
        ambient_coherence = spectral_data.get('ambient_coherence', True)
        return not high_freq_loss and ambient_coherence

    def validate_voice(self, current_embedding, stored_embedding, audio_features, spectral_data):
        """
        Executa a validação completa conforme o Caderno Técnico.
        VoiceAuth_valid = SpeakerMatch AND LivenessPass AND AntiReplayPass
        """
        similarity = self.calculate_cosine_similarity(current_embedding, stored_embedding)
        speaker_match = similarity >= self.threshold_similarity
        
        liveness_pass = self.check_liveness(audio_features)
        anti_replay_pass = self.check_anti_replay(spectral_data)
        
        is_valid = speaker_match and liveness_pass and anti_replay_pass
        
        return {
            "VoiceAuth_valid": 1 if is_valid else 0,
            "details": {
                "similarity": round(similarity, 4),
                "speaker_match": speaker_match,
                "liveness_pass": liveness_pass,
                "anti_replay_pass": anti_replay_pass
            }
        }

# Exemplo de uso (Mock)
if __name__ == "__main__":
    engine = VoiceAuthEngine()
    
    # Dados simulados
    mock_stored = np.random.rand(128)
    mock_current = mock_stored * 0.95  # Alta similaridade
    mock_features = {'hnr': 20, 'f0_std': 8}
    mock_spectral = {'high_freq_loss': False, 'ambient_coherence': True}
    
    result = engine.validate_voice(mock_current, mock_stored, mock_features, mock_spectral)
    print(f"Resultado da Validação: {result}")
