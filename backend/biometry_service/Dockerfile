# Dockerfile para deploy no Railway/Render/AWS
FROM python:3.9-slim

WORKDIR /app

# Instalar dependências de sistema para áudio (libsndfile)
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar (usando caminho relativo à raiz do repo)
COPY backend/biometry_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código (usando caminho relativo à raiz do repo)
COPY backend/biometry_service/main.py .

# Expor porta
EXPOSE 8000

# Comando de inicialização
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
