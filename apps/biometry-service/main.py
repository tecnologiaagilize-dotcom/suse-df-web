import os
import shutil
import tempfile
import uuid
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

# Importa engine de biometria (carrega o modelo na inicialização)
# Isso pode demorar um pouco no start
try:
    from biometry import biometry_engine
except ImportError as e:
    print(f"Erro crítico ao importar biometry_engine: {e}")
    # Em desenvolvimento, pode ser que falte dependência, mas em prod deve falhar o deploy
    biometry_engine = None

app = FastAPI(title="SUSE-DF Voice Biometry Service")

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permitir frontend (Vercel)
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Erro ao conectar Supabase: {e}")
else:
    print("AVISO: Variáveis SUPABASE_URL ou SUPABASE_KEY não encontradas! O serviço não conseguirá buscar referências.")

@app.get("/")
def read_root():
    return {
        "status": "online", 
        "service": "voice-biometry-ai", 
        "model_loaded": biometry_engine is not None
    }

@app.post("/verify")
async def verify_voice(
    user_id: str = Form(...),
    audio_file: UploadFile = File(...),
    reference_type: str = Form("secret_word") # 'secret_word' ou 'biometry_phrase'
):
    """
    Recebe um áudio de voz (blob) e o ID do usuário.
    Baixa o áudio de referência do Supabase e compara.
    Retorna score de similaridade e verificação (true/false).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Serviço de banco de dados não configurado.")
        
    if not biometry_engine:
        raise HTTPException(status_code=503, detail="Modelo de IA não carregado.")
    
    temp_dir = tempfile.mkdtemp()
    try:
        # 1. Salvar áudio recebido (teste)
        # O arquivo vem como UploadFile (spooled temp file). Vamos salvar com extensão .wav
        test_audio_path = os.path.join(temp_dir, f"test_{uuid.uuid4()}.wav")
        with open(test_audio_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)
            
        # 2. Buscar URL do áudio de referência no Supabase
        # Vamos buscar o 'secret_word_audio_url' por padrão para emergência
        try:
            user_data = supabase.table("users").select("*").eq("id", user_id).single().execute()
        except Exception as db_err:
             print(f"Erro ao buscar usuário {user_id}: {db_err}")
             raise HTTPException(status_code=404, detail="Usuário não encontrado ou erro de banco.")
        
        if not user_data.data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
        ref_url = user_data.data.get("secret_word_audio_url")
        
        if not ref_url:
            # Fallback para biometria 1 se não tiver frase secreta gravada
            ref_url = user_data.data.get("voice_biometry_1_url")
            
        if not ref_url:
             raise HTTPException(status_code=400, detail="Usuário não possui biometria de voz cadastrada (referência ausente).")

        # 3. Baixar áudio de referência
        ref_audio_path = os.path.join(temp_dir, f"ref_{uuid.uuid4()}.wav")
        
        print(f"Baixando referência de: {ref_url}")
        try:
            response = requests.get(ref_url, timeout=10)
            if response.status_code != 200:
                 raise HTTPException(status_code=500, detail=f"Falha ao baixar áudio de referência: {response.status_code}")
                 
            with open(ref_audio_path, "wb") as f:
                f.write(response.content)
        except Exception as dl_err:
            print(f"Erro download: {dl_err}")
            raise HTTPException(status_code=500, detail="Erro de rede ao baixar referência.")

        # 4. Executar verificação biométrica (IA)
        print("Iniciando comparação biométrica...")
        score, is_match = biometry_engine.verify_files(ref_audio_path, test_audio_path)
        
        print(f"Biometria User {user_id}: Score={score:.4f}, Match={is_match}")
        
        return {
            "verified": is_match,
            "score": score,
            "threshold": 0.25, # Threshold padrão do ECAPA (pode ajustar)
            "details": "Verificação Biométrica com IA (SpeechBrain/ECAPA-TDNN)"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro interno: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Limpar arquivos temporários
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    import uvicorn
    # Rodar servidor
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
