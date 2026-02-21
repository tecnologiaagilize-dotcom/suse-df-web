# Estágio de Build (Compilação e Download)
FROM python:3.10-slim as builder

WORKDIR /app

# Instalar compiladores necessários
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar apenas o requirements (ajustado para contexto local /apps/biometry-service)
COPY requirements.txt .

# Instalar dependências no diretório do usuário
# Forçar PyTorch CPU para reduzir tamanho (crítico para Railway Free)
RUN pip install --user --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --user --no-cache-dir -r requirements.txt

# Estágio Final (Runtime Leve)
FROM python:3.10-slim

WORKDIR /app

# Instalar apenas dependências de runtime do sistema para áudio
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copiar pacotes Python instaladas do estágio builder
COPY --from=builder /root/.local /root/.local

# Adicionar o diretório de pacotes do usuário ao PATH
ENV PATH=/root/.local/bin:$PATH

# Copiar APENAS os arquivos de código fonte necessários
# Ajustado para contexto local
COPY main.py .
COPY biometry.py .

# Variáveis de ambiente
ENV TORCH_HOME=/tmp/torch_cache
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
