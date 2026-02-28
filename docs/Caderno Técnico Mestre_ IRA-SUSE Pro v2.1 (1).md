# Caderno Técnico Mestre: IRA-SUSE Pro v2.1

**Versão:** 2.1 | **Data:** 28 de Fevereiro de 2026 | **Autor:** Manus AI

---

## 1. Visão Geral e Arquitetura do Sistema

O sistema **IRA-SUSE** foi concebido para integrar monitoramento de impacto, biometria de voz, acionamento manual e transmissão de áudio em tempo real, visando assegurar uma resposta ágil e eficaz em cenários de emergência. O motor principal opera com uma lógica de fusão de sensores, onde a biometria de voz e o acionamento por botão físico são os elementos decisórios primários para o acionamento da Central de Monitoramento, enquanto o impacto e o áudio live servem como camadas cruciais de evidência e contexto.

### 1.1. Stack Tecnológica Principal

-   **Frontend:** Painel de Monitoramento (Vercel)
-   **Backend:** API Orquestradora (Python/FastAPI em Railway)
-   **Banco de Dados e Auth:** Supabase (PostgreSQL, Auth, Storage)
-   **Comunicação Real-time:** WebRTC com SFU mediasoup e TURN/STUN coturn

## 2. Motor de Decisão e Escalonamento

O acionamento da Central de Monitoramento (`EmergencyCall = 1`) é regido por uma matriz de decisão multicritério que agora integra o fluxo de áudio WebRTC.

**Tabela 1: Matriz de Resposta Automática Integrada**
| Gatilho | Ação Imediata | Fluxo de Áudio |
| :--- | :--- | :--- |
| **Botão SOS** | Alerta Central + WhatsApp | Inicia Live WebRTC + Gravação |
| **Voz Validada** | Alerta Central + WhatsApp | Inicia Live WebRTC + Gravação |
| **Impacto Crítico (≥ 0.85)** | Alerta WhatsApp | Congela Pre-roll (20-30s) |
| **Impacto Crítico + Silêncio/Estresse** | Alerta Central + WhatsApp | Inicia Live WebRTC + Gravação |

## 3. Módulo de Biometria de Voz (VoiceAuth Engine)

A validação biométrica é um componente crítico, projetado para mitigar falsos positivos e resistir a ataques de personificação. A variável `VoiceAuth_valid` é determinada pela conjunção de três fatores essenciais.

**Tabela 2: Componentes do VoiceAuth Engine**
| Componente | Descrição Técnica | Critério de Sucesso |
| :--- | :--- | :--- |
| **SpeakerMatch** | Comparação de *embeddings* neurais (e.g., ECAPA-TDNN). | Similaridade de Cosseno ≥ 0.75 |
| **Liveness** | Análise de microvariações (Jitter/Shimmer) e HNR. | Coerência harmônica e prosódia dinâmica. |
| **Anti-Replay** | Detecção de artefatos espectrais e coerência ambiental. | Ausência de distorções e descontinuidade acústica. |

> **Requisito de Performance:** A latência do processo deve ser inferior a **300ms** [1].

## 4. Módulo de Áudio Live (WebRTC)

O sistema utiliza uma arquitetura baseada em **SFU (Selective Forwarding Unit)** para garantir baixa latência e escalabilidade.

### 4.1. Evidência Dupla e Retenção

A integridade da prova é garantida pela captura simultânea em duas frentes (client-side e server-side), com hashing SHA-256 de todos os segmentos. A retenção segue a política `closed_at + prazo_legal`, com expurgo automatizado [2].

### 4.2. Ciclo de Vida da Sessão

-   **Duração Máxima:** 45 minutos por sessão.
-   **Renovação:** Obrigatória com aviso em T-3 minutos para garantir a continuidade e a segurança através da emissão de novos tokens JWT [2].

## 5. Módulo de Rastreio e Notificações

Em qualquer evento de alerta, o sistema inicia o compartilhamento de localização via WhatsApp utilizando *deep links*.

-   **Atualização de GPS:** A cada 5 segundos.
-   **Segurança:** Links gerados com tokens JWT/HMAC de expiração automática.
-   **Mensagem:** Inclui link para Google Maps e para a plataforma de acompanhamento ao vivo.

## 6. Proposta de Otimização Estratégica (IRA-SUSE Pro)

Para elevar o sistema a um novo patamar de eficiência, as seguintes otimizações são propostas:

### 6.1. Otimização de Biometria: Edge AI First

Executar a inferência biométrica (`SpeakerMatch`) diretamente no dispositivo usando modelos quantizados (TFLite/CoreML) para reduzir a latência de validação para **< 50ms** e economizar até 40% de banda com VAD (Voice Activity Detection) local.

### 6.2. Otimização WebRTC: Arquitetura Híbrida

Implementar uma tentativa de conexão **Peer-to-Peer (P2P)** antes de recorrer ao SFU e configurar o codec Opus para operar em modo de **bitrate dinâmico (VBR)**, garantindo a comunicação mesmo em redes de baixa qualidade (6-12 kbps).

### 6.3. Resiliência de Dados: "Black Box" Local

Manter um **buffer de pré-roll circular de 30 segundos** em memória RAM criptografada, realizando o *flush* imediato para o Supabase assim que um impacto for detectado.

## 7. Especificações de Performance Consolidadas

-   **Latência de Biometria (Pro):** < 50ms (com Edge AI)
-   **Latência de Detecção de Impacto:** < 200ms
-   **Taxa de Falso Acionamento da Central:** < 0.01%
-   **Duração do Rastreio:** 30 minutos (padrão)

## 8. Referências

[1] Caderno Técnico Módulo Impacto + WhatsApp + Biometria IRA-SUSE v1.3.
[2] Caderno Técnico Módulo 09: Áudio Live (WebRTC) v1.0.
