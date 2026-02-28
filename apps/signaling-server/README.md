# Instruções de Deploy - Signaling Server

## 1. Pré-requisitos
- Conta no Railway (ou outro provedor de container)
- Supabase URL e Service Role Key

## 2. Variáveis de Ambiente
Configure as seguintes variáveis no seu ambiente de deploy:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta
PORT=8000
```

## 3. Deploy no Railway
1. Conecte este repositório ao Railway.
2. Aponte o diretório raiz para `apps/signaling-server`.
3. O Railway detectará o `Dockerfile` automaticamente.
4. Adicione as variáveis de ambiente.
5. O serviço estará disponível em `https://seu-app.up.railway.app`.

## 4. Integração no Frontend
No arquivo `AudioStreamingService.js` (a ser criado/atualizado), aponte a URL do socket para o endereço do deploy acima.
