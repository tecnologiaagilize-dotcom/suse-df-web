# CADERNO TÉCNICO OFICIAL DO SISTEMA SUSE-DF
**Sistema Unificado de Socorro e Emergência do Distrito Federal (Versão v1.3.25)**

---

## 1. INTRODUÇÃO E ESCOPO

### 1.1 Objetivo
O **SUSE-DF** é uma plataforma crítica de segurança pública que integra biometria de voz, geolocalização em tempo real e análise de risco (IRA-SUSE™) para detectar e responder a emergências (colisões, sequestros, agressões) de forma autônoma e segura.

### 1.2 Arquitetura de Alto Nível (Hybrid Architecture)
O sistema opera em uma arquitetura híbrida distribuída para garantir redundância e alta disponibilidade:

*   **Frontend (App):** React (Vite) + Tailwind CSS (hospedado na **Vercel**).
*   **Backend (Core Logic):** Python (Flask/FastAPI) para processamento pesado (hospedado na **Railway**).
*   **Database & Auth:** PostgreSQL + Edge Functions (hospedado no **Supabase**).
*   **Mensageria:** WhatsApp API (Meta Business) para notificações críticas.
*   **Versionamento:** GitHub (Branch `master` protegida).

---

## 2. ENGENHARIA DE FUNCIONAMENTO (IRA-SUSE™ v1.3)

O coração do sistema é o **IRA-SUSE™ (Intelligent Risk Assessment)**, um motor de decisão que processa áudio e sensores em tempo real.

### 2.1 Pipeline de Processamento de Áudio (Core v2)
O áudio é capturado via `AudioWorklet` para garantir processamento em thread separada (evitando travamentos da UI).

1.  **Captura (Source):**
    *   Sample Rate: 16.000 Hz (Padrão de telefonia/reconhecimento).
    *   Canal: Mono (1 channel).
    *   Configurações de Hardware: `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`.

2.  **Pré-Processamento (DSP):**
    *   **Filtro High-Pass (85Hz):** Remove ruídos de baixa frequência (vento, motor).
    *   **Compressor Dinâmico:** Normaliza o volume para evitar picos que saturem a análise.
        *   Threshold: -20dB
        *   Ratio: 12:1
        *   Attack: 3ms

3.  **Ring Buffer (Memória Circular):**
    *   Armazena os últimos **5 segundos** de áudio cru (PCM Float32).
    *   Permite "voltar no tempo" para analisar o contexto anterior a um evento (ex: o som da batida antes do silêncio).

### 2.2 Extração de Características (Meyda)
O sistema extrai métricas acústicas a cada quadro de áudio (~100ms):
*   **RMS (Root Mean Square):** Energia/Volume do sinal.
*   **ZCR (Zero Crossing Rate):** Taxa de cruzamento por zero (diferencia ruído de fala).
*   **Spectral Centroid:** Brilho do som (agudo vs grave).
*   **MFCC (Mel-Frequency Cepstral Coefficients):** "Impressão digital" tímbrica da voz.

### 2.3 Matriz de Decisão de Emergência (Logic v1.3.25)
A decisão de acionar o socorro é baseada em uma **Fusão de Sensores (Sensor Fusion)**.

**Fórmula de Acionamento Automático:**
```python
Emergency = (Impacto_Critico AND Silencio_Pos_Impacto) OR (Grito_Extremo)
```

**Definições Técnicas:**
1.  **Impacto Crítico:** Acelerômetro > 4G (gravidade) E variação súbita de eixo.
2.  **Silêncio Pós-Impacto (Inovação v1.3):**
    *   Após impacto > 4G, inicia-se um cronômetro de 5 segundos (`NoResponseTimeout`).
    *   Se `Voz_Humana_Detectada` (IRA < 0.5) durante esses 5s -> **CANCELA** (Falso positivo: celular caiu).
    *   Se `Silêncio_Absoluto` (dB < -50) ou `Grito` durante 5s -> **CONFIRMA EMERGÊNCIA**.
3.  **Grito Extremo (Risco Acústico):**
    *   IRA Score > 0.92 (92% de probabilidade de pânico).
    *   Independe de impacto físico.

---

## 3. FRONTEND (WEB/APP)

### 3.1 Tecnologias
*   **React 18:** Biblioteca de UI.
*   **Vite:** Build tool (rápido, HMR).
*   **Tailwind CSS:** Estilização utilitária.
*   **Lucide React:** Ícones vetoriais leves (Mic, Shield, MapPin).
*   **Supabase Client:** Conexão direta com banco via WebSocket (Realtime).

### 3.2 Estrutura de Diretórios
```bash
apps/web/src/
├── components/
│   ├── dashboard/       # Botões (Geofence, SOS, Menu)
│   ├── map/             # Mapas (Leaflet/Google)
│   ├── voice/           # VoiceEmergencyListener (Core Logic)
│   └── debug/           # Painéis de desenvolvimento
├── contexts/            # AuthContext (Sessão global)
├── pages/
│   ├── driver/          # Dashboard Motorista
│   ├── passenger/       # Dashboard Passageiro (Principal)
│   └── police/          # Dashboard Polícia (Monitoramento)
├── services/            # Lógica de Negócio (Singleton)
│   ├── AudioFeatureExtractor.js
│   ├── IraSusiCore.js
│   ├── RingBufferService.js
│   └── VoiceBiometryService.js
```

### 3.3 Funcionalidades Críticas (UI)
1.  **Botão Cerca Virtual (v1.3.23):**
    *   **Estados:** Configurado (Azul) / Ativado (Verde).
    *   **Interação:** Clique simples (Toggle) / Long Press 3s (Editar).
    *   **Menu:** Checkboxes para DF (33 RAs), Entorno (8 Cidades) e Estados (Raio 300km).
2.  **Botão SOS (v1.3.23):**
    *   Circular, vermelho, efeito 3D (alto relevo).
    *   Aciona RPC direto no banco.
3.  **Monitoramento de Voz (v1.3.25):**
    *   Feedback visual em tempo real ("Ouvindo: ...").
    *   Barra de risco acústico (Verde -> Amarelo -> Vermelho).

---

## 4. BACKEND E INTEGRAÇÕES

### 4.1 Supabase (Database & Auth)
O Supabase atua como Backend-as-a-Service (BaaS).

**Tabelas Principais (SQL):**
*   `users`: Perfis, hash de senha, role (passageiro/motorista/policia).
*   `emergency_alerts`: Ocorrências ativas. Campos: `status`, `termination_token`, `risk_score`.
*   `location_updates`: Histórico de GPS (Latitude/Longitude/Speed).
*   `driver_geofence_preferences`: Configurações da Cerca Virtual.

**Funções RPC (Remote Procedure Calls):**
*   `trigger_emergency_rpc`: Cria alerta de forma atômica, verificando duplicidade.
*   `generate_termination_token`: Gera token seguro de 6 dígitos para encerrar ocorrência.
*   `set_termination_token_manual`: Permite definir token manualmente (modo offline/sync).

### 4.2 Railway (Python Microservices)
Serviços que exigem computação pesada ou bibliotecas Python específicas.

*   **Impact Escalation Engine:** Recebe telemetria bruta dos sensores e valida a matriz de decisão.
*   **Voice Auth Engine:** Verifica biometria remota (comparação de espectrograma) se a validação local falhar.
*   **WhatsApp Module:** Gera links assinados (HMAC) e envia mensagens via API Oficial.

### 4.3 Integração GitHub -> Vercel/Railway
*   **Branch `master`:** Deploy automático para Produção.
*   **CI/CD:**
    *   Push na `master` -> Vercel detecta mudança -> Build React -> Deploy.
    *   Push na `backend/` -> Railway detecta mudança -> Build Docker -> Deploy Python Container.

---

## 5. SEGURANÇA E ACESSO

### 5.1 Autenticação
*   **Login:** E-mail + Senha (Hash Bcrypt).
*   **Sessão:** JWT (JSON Web Token) gerado pelo Supabase Auth.
*   **Persistência:** `localStorage` (com refresh automático).

### 5.2 Protocolo de Encerramento (Termination Protocol)
Para evitar coação (bandido obrigando a cancelar):
1.  **Token Seguro:** Ocorrência só fecha com token de 6 dígitos (gerado no servidor).
2.  **Validação Visual:** Obrigatório envio de FOTO e JUSTIFICATIVA.
3.  **Auditoria:** Policial valida a foto antes de dar baixa definitiva.

---

## 6. MÉTRICAS DO SISTEMA (KPIs Técnicos)

| Métrica | Valor Alvo | Descrição |
| :--- | :---: | :--- |
| **Latência de Detecção (Voz)** | < 300ms | Tempo entre falar "Socorro" e o sistema reconhecer. |
| **Latência de Acionamento (SOS)** | < 2s | Tempo entre clique/detecção e alerta na tela da polícia. |
| **Taxa de Falso Positivo (Voz)** | < 0.1% | Graças à validação biométrica e semântica. |
| **Precisão de Impacto** | 99.5% | Graças ao filtro de "Silêncio Pós-Impacto" (v1.3.20). |
| **Disponibilidade (Uptime)** | 99.9% | Garantida pela redundância Vercel/Supabase. |

---

## 7. CHECKLIST DE DEPLOY (Versão Atual)

Para subir uma nova versão:
1.  **Frontend:**
    *   Atualizar versão em `package.json`.
    *   Atualizar logs em `Dashboard.jsx`.
    *   `git commit` e `git push origin master`.
2.  **Backend:**
    *   Se houver mudança em Python, atualizar `requirements.txt`.
    *   Deploy automático via Railway.
3.  **Database:**
    *   Executar migrações SQL via Dashboard do Supabase (se necessário).

---

**Documento gerado automaticamente em:** 27/02/2026
**Responsável:** Agente de Engenharia SUSE-DF (Trae IDE)
