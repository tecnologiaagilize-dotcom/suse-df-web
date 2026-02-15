import os
import io
import torch
import torchaudio
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from speechbrain.inference.speaker import SpeakerRecognition
from supabase import create_client, Client
import numpy as np

# Configuração do Ambiente
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="SUSE-DF Voice Biometry Service")

# CORS (Permitir requisições do frontend/edge functions)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Inicializar Modelo de Reconhecimento de Locutor (SpeechBrain)
# Usaremos o ECAPA-TDNN pré-treinado no VoxCeleb
print("Carregando modelo biométrico (pode demorar na primeira execução)...")
verification_model = SpeakerRecognition.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    savedir="tmp_model"
)
print("Modelo carregado com sucesso!")

def load_audio_from_bytes(audio_bytes: bytes):
    """Converte bytes de áudio para tensor do Torch"""
    try:
        # Usa torchaudio para decodificar o stream de memória
        audio_tensor, sample_rate = torchaudio.load(io.BytesIO(audio_bytes))
        
        # O modelo espera mono, 16kHz
        # Se for estéreo, converte para mono
        if audio_tensor.shape[0] > 1:
            audio_tensor = torch.mean(audio_tensor, dim=0, keepdim=True)
            
        # Resample se necessário
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(sample_rate, 16000)
            audio_tensor = resampler(audio_tensor)
            
        return audio_tensor.squeeze()
    except Exception as e:
        print(f"Erro ao processar áudio: {e}")
        raise HTTPException(status_code=400, detail="Formato de áudio inválido")

@app.get("/")
def health_check():
    return {"status": "online", "model": "ECAPA-TDNN"}

from pydantic import BaseModel

class VerifyRequest(BaseModel):
    audio_base64: str
    user_id: str

@app.post("/verify")
async def verify_speaker(request: VerifyRequest):
    """
    Recebe JSON com áudio base64 e ID do usuário.
    """
    try:
        # 1. Decodificar Base64
        import base64
        probe_bytes = base64.b64decode(request.audio_base64)
        probe_waveform = load_audio_from_bytes(probe_bytes)

        # 2. Buscar amostras de referência do usuário no Supabase
        user_id = request.user_id
        user_data = supabase.table("users").select(
            "voice_biometry_1_url, voice_biometry_2_url, voice_biometry_3_url"
        ).eq("id", user_id).single().execute()
        
        if not user_data.data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        references = []
        urls = [
            user_data.data.get('voice_biometry_1_url'),
            user_data.data.get('voice_biometry_2_url'),
            user_data.data.get('voice_biometry_3_url')
        ]
        
        # Baixar e processar cada áudio de referência válido
        for url in urls:
            if url:
                try:
                    # Assumindo que a URL é pública ou assinada.
                    # Se for storage interno, usamos o método download do supabase-py
                    # Extrair o caminho do arquivo da URL (ex: "bucket/folder/file.webm")
                    # Simplificação: Vamos baixar via requests se for URL http, ou storage se for path
                    
                    # Para simplificar neste MVP, vamos baixar direto do Storage usando o path relativo
                    # Path esperado: "{user_id}/biometry_X.webm"
                    # Precisamos fazer parse da URL ou assumir o padrão
                    path = url.split("voice-recordings/")[-1] 
                    
                    file_data = supabase.storage.from_("voice-recordings").download(path)
                    ref_waveform = load_audio_from_bytes(file_data)
                    references.append(ref_waveform)
                except Exception as e:
                    print(f"Erro ao carregar referência {url}: {e}")
                    continue

        if not references:
            raise HTTPException(status_code=400, detail="Usuário sem biometria cadastrada")

        # 3. Comparar Probe com Referências
        scores = []
        for ref_wav in references:
            # O modelo retorna um tensor de score (Cosine Similarity)
            score, prediction = verification_model.verify_batch(probe_waveform, ref_wav)
            scores.append(score.item())

        # 4. Decisão
        # ECAPA-TDNN Threshold comum é ~0.25 para baixa FAR (False Acceptance Rate)
        # Vamos usar a média dos scores
        avg_score = np.mean(scores)
        threshold = 0.25 
        
        is_verified = avg_score > threshold

        return {
            "is_verified": bool(is_verified),
            "score": float(avg_score),
            "threshold": threshold,
            "details": f"Comparado com {len(references)} amostras"
        }

    except Exception as e:
        print(f"Erro interno: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
