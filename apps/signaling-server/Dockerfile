# Configuração do Docker para Railway
FROM python:3.9-slim

WORKDIR /app

# Instalar dependências do sistema necessárias para mediasoup/webrtc
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    libssl-dev \
    libffi-dev \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Porta padrão
EXPOSE 8000

# Comando de inicialização
CMD ["python", "server.py"]
