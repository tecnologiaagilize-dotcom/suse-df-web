# Caderno Técnico: Sistema de Emergência por Voz e Monitoramento (SUSE-DF)

## 1. Visão Geral da Solução
Este documento detalha a implementação técnica do módulo de **Acionamento de Emergência por Voz**, incluindo as camadas de Frontend (React/PWA), Backend (Python/Supabase) e Infraestrutura de Resiliência (Offline-First).

O objetivo é permitir que motoristas em situação de perigo acionem um alerta silencioso e seguro utilizando apenas a voz, com validação biométrica e funcionamento mesmo em zonas de sombra (sem internet).

---

## 2. Arquitetura do Sistema

### 2.1 Fluxo de Dados
1.  **Captura (Frontend):** O navegador captura o áudio em tempo real (`Web Speech API` + `MediaRecorder`).
2.  **Detecção Local (KWS):** O algoritmo de janela deslizante verifica se a frase "Socorro" (ou similar) foi dita.
3.  **Validação Biométrica (IA):** O áudio é enviado para um microserviço Python (Railway) que compara a voz com o padrão do motorista.
4.  **Acionamento (Backend):** Se validado (ou em caso de falha segura/fail-open), uma RPC no Supabase cria o alerta.
5.  **Offline (PWA):** Se não houver internet, o alerta é salvo no dispositivo e sincronizado automaticamente quando a conexão retornar.

---

## 3. Componentes Implementados

### A. Frontend (React + Vite)
*   **`VoiceEmergencyListener.jsx`**: "Ouvido" do sistema.
    *   Implementa **Buffer Circular** de áudio (mantém os últimos 15s na memória).
    *   Possui lógica de **Reinício Inteligente (Backoff)** para evitar travamentos do navegador.
    *   Integração com feedback tátil (vibração) ao detectar comando.
*   **`VoiceBiometryService.js`**: Cliente de comunicação com a IA.
    *   Implementa a lógica **Fail-Open**: Se o servidor de IA cair, o alerta é aprovado para garantir a segurança da vida.
*   **PWA (Progressive Web App)**:
    *   Service Worker configurado para cache de assets.
    *   Manifesto para instalação em Android/iOS.
    *   **Fila Offline:** `OfflineQueueService.js` gerencia alertas pendentes no `localStorage`.

### B. Backend (Python - FastAPI)
*   Hospedado no **Railway**.
*   Usa **SpeechBrain (ECAPA-TDNN)** para verificação de locutor.
*   Conecta-se ao Supabase Storage para baixar áudios de referência.
*   Endpoint: `POST /verify` (Recebe áudio Base64 + UserID).

### C. Banco de Dados (Supabase + PostgreSQL)
*   **RPCs de Segurança:**
    *   `trigger_emergency_rpc`: Cria alertas e impede duplicidade (retorna alerta existente se já ativo).
*   **Storage:** Bucket `voice-recordings` para armazenar amostras de voz.

---

## 4. Guia de Configuração e Deploy

### 4.1 Variáveis de Ambiente (Frontend)
No painel da Vercel, configure:
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_BIOMETRY_SERVICE_URL=https://suse-df-web-production.up.railway.app
```

### 4.2 Banco de Dados (Scripts SQL)
Scripts essenciais já rodados:
1.  `backend/voice_config_setup.sql` (Storage e Tabelas)
2.  `backend/rpc_trigger_emergency_v2.sql` (Lógica de Alerta)

### 4.3 Serviço Python
*   Repositório: `backend/biometry_service`
*   Env Vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 5. Procedimentos de Teste

### Teste de Biometria (Ponta a Ponta)
1.  Acesse o Painel do Motorista.
2.  Garanta que o ícone de microfone esteja verde ("Monitoramento Ativo").
3.  Diga a frase de emergência.
4.  O celular deve vibrar e a tela ficar vermelha.

### Teste Offline
1.  Desative Wi-Fi/Dados do celular.
2.  Acione o botão SOS ou Voz.
3.  Verifique a mensagem "Sem conexão. Alerta salvo...".
4.  Reative a internet.
5.  O alerta deve aparecer no Painel Admin em alguns segundos.

---

**Status Final:** Projeto Entregue e Documentado.
Versão: 3.1 (Voice + PWA Stable)
