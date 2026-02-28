import os
import torch
import torchaudio
from speechbrain.inference.speaker import SpeakerRecognition

class VoiceBiometry:
    def __init__(self):
        # Carrega o modelo de reconhecimento de locutor
        # ECAPA-TDNN treinado no VoxCeleb (Speaker Verification)
        print("Carregando modelo SpeechBrain (ECAPA-TDNN)... isso pode demorar na primeira vez.")
        
        # O modelo será salvo em /tmp/speechbrain_model para evitar problemas de permissão
        # No Railway, o disco efêmero funciona bem para cache de execução
        # Usamos savedir diferente para evitar conflito de permissão
        import tempfile
        tmp_dir = os.path.join(tempfile.gettempdir(), "speechbrain_model")
        os.makedirs(tmp_dir, exist_ok=True)
        
        try:
            self.verification_model = SpeakerRecognition.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir=tmp_dir,
                run_opts={"device": "cpu"} # Força CPU para evitar erros se não houver GPU
            )
            print("Modelo de Biometria de Voz carregado com sucesso!")
        except Exception as e:
            print(f"ERRO CRÍTICO ao carregar modelo SpeechBrain: {e}")
            # Em vez de crashar, podemos deixar o modelo como None e tratar no verify
            self.verification_model = None

    def verify_files(self, file1_path, file2_path):
        """
        Compara dois arquivos de áudio locais e retorna score e decisão.
        Retorna: (score: float, is_match: bool)
        """
        if self.verification_model is None:
             raise RuntimeError("Modelo de biometria não foi carregado corretamente.")
             
        try:
            # verify_files já cuida do carregamento e pré-processamento
            score, prediction = self.verification_model.verify_files(file1_path, file2_path)
            
            # O score é log-likelihood ratio ou similaridade cosseno dependendo do modelo
            # ECAPA usa Cosine Similarity (-1 a 1).
            # Vamos normalizar ou usar o prediction bool do modelo que usa um threshold otimizado.
            
            return float(score), bool(prediction)
        except Exception as e:
            print(f"Erro na verificação biométrica: {e}")
            raise e

# Instância Singleton para ser importada no main.py
# A inicialização ocorre no import, garantindo que o modelo carregue no startup
biometry_engine = VoiceBiometry()
