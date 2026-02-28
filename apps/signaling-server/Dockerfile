# Configuração do Docker para Railway (Monorepo context)
FROM python:3.9-slim

WORKDIR /app

# Instalar dependências do sistema (incluindo dependências do PyAV/FFmpeg)
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    libssl-dev \
    libffi-dev \
    net-tools \
    pkg-config \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    libopus-dev \
    libvpx-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements.txt a partir da raiz do contexto
COPY apps/signaling-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fonte a partir da raiz do contexto
COPY apps/signaling-server/ .

# Porta padrão
EXPOSE 8000

# Comando de inicialização
CMD ["python", "server.py"]
