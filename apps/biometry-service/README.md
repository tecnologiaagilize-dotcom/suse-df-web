# Microserviço de Biometria de Voz (Python/FastAPI)

Este serviço usa Inteligência Artificial (SpeechBrain/ECAPA-TDNN) para comparar dois áudios e verificar se pertencem ao mesmo locutor.

## Tecnologias
- **FastAPI**: Framework web assíncrono de alta performance.
- **SpeechBrain**: Toolkit de código aberto para IA de fala.
- **ECAPA-TDNN**: Modelo estado da arte para Speaker Verification.
- **Supabase**: Backend para buscar áudios de referência.

## Como Rodar Localmente

1. Crie um ambiente virtual Python (recomendado 3.10+):
   ```bash
   python -m venv venv
   # Linux/Mac
   source venv/bin/activate
   # Windows
   venv\Scripts\activate
   ```

2. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

3. Copie o `.env.example` para `.env` e preencha com suas credenciais do Supabase:
   ```
   SUPABASE_URL=...
   SUPABASE_KEY=...
   ```

4. Rode o servidor:
   ```bash
   uvicorn main:app --reload
   ```
   O servidor iniciará em `http://localhost:8000`.

## Deploy no Railway (Recomendado)

1. Faça login no [Railway](https://railway.app/).
2. Crie um novo projeto "Deploy from GitHub repo".
3. Selecione este repositório.
4. Nas configurações do serviço no Railway:
   - Defina o **Root Directory** como `apps/biometry-service`.
   - Adicione as variáveis de ambiente `SUPABASE_URL` e `SUPABASE_KEY`.
5. O Railway detectará o `Dockerfile` e fará o build automaticamente.
   - **Atenção:** O build inicial pode levar de 5 a 10 minutos devido ao download do PyTorch e SpeechBrain.

## Uso da API

### Endpoint: `POST /verify`

Recebe um áudio de teste e compara com o áudio de referência do usuário (frase secreta ou biometria 1).

**Parâmetros (Form-Data):**
- `user_id`: UUID do usuário no Supabase.
- `audio_file`: Arquivo de áudio (Blob/File) gravado no momento.

**Exemplo de Resposta:**
```json
{
  "verified": true,
  "score": 0.7842,
  "threshold": 0.25,
  "details": "Verificação Biométrica com IA (SpeechBrain/ECAPA-TDNN)"
}
```

- **Score > 0.25**: Alta probabilidade de ser o mesmo locutor.
- **Score < 0.25**: Provável impostor ou áudio de baixa qualidade.
