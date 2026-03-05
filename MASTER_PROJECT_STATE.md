# SUSE-DF Project Master Plan & Handover Documentation
**Versão Atual:** v1.3.39 (Audio Core Optimization)
**Data:** 03/03/2026
**Contexto:** Ponto de controle para evitar regressão em novas sessões.

---

## 1. Visão Geral e Arquitetura
O **SUSE-DF** é um sistema de monitoramento e emergência para motoristas de aplicativo.
*   **Frontend:** React (Vite), PWA, Tailwind CSS.
*   **Backend:** Supabase (Auth, Database, Realtime, Edge Functions).
*   **AI/Voz:** Processamento híbrido (Local no navegador via AudioWorklet/Meyda + Integração futura com Python/Railway).
*   **Deploy:** Vercel (Frontend).

## 2. Módulos Críticos (Estado da Arte)
Estes módulos estão **estabilizados**. Qualquer alteração deve ser feita com extremo cuidado para não reintroduzir bugs de performance (INP) ou lógica.

### A. Monitoramento de Voz (IRA-SUSI v1.3.39)
*   **Arquivo Principal:** `apps/web/src/components/voice/VoiceEmergencyListener.jsx`
*   **Processador de Áudio:** `apps/web/public/workers/suse-audio-processor.js`
*   **Melhorias v1.3.39 (Compliance):**
    *   **Sample Rate 48kHz:** Otimizado para qualidade de análise semântica (antes 16kHz).
    *   **Sliding Window Match:** Implementada busca por janela deslizante (20 palavras) para encontrar a frase de emergência mesmo em frases longas, corrigindo o erro de "não alcançar o alvo".
    *   **VAD Threshold Ajustado:** Aumentado para **45** (antes 25) no `VoiceActivityService.js` para reduzir falsos positivos e "ativação muito rápida".
    *   **Debounce de Silêncio:** Aumentado para **1.5s** para evitar cortes na fala.
*   **Lógica Atual:**
    *   Usa **AudioWorklet** para capturar áudio fora da Main Thread.
    *   **Buffer Circular:** Implementado via ScriptProcessor (Shadow Recording) para capturar evidências.

### B. Painel do Motorista & SOS
*   **Arquivo:** `apps/web/src/pages/driver/Dashboard.jsx`
*   **Lógica de SOS:**
    1.  Tenta chamar RPC `trigger_emergency_rpc` (Supabase Edge Function).
    2.  **Fallback Automático:** Se a RPC falhar ou houver erro de rede, executa `handleSOSFallback` (inserção direta no banco).
    3.  **Fila Offline:** Se não houver internet, salva no `OfflineQueueService`.
*   **Performance:** Monitoramento de `PerformanceObserver` implementado para detectar tarefas longas.

### C. Termos Legais (LGPD)
*   **Arquivo:** `apps/web/src/pages/LegalTerms.jsx`
*   **Correção Recente:** Caminhos de importação corrigidos.

---

## 3. Guia de Deploy (Vercel)
Para que o deploy funcione corretamente, as seguintes regras devem ser seguidas:
1.  **Usuário Git:** Os commits devem ser feitos estritamente com:
    *   User: `tecnologiaagilize-dotcom`
    *   Email: `tecnologiaagilize@gmail.com`
    *   *Motivo:* O Vercel bloqueia commits de autores não verificados.
2.  **Gatilho:** O Vercel monitora a branch `master`. Alterações em arquivos dentro de `apps/web` (especialmente `package.json`) disparam o build.

---

## 4. Problemas Resolvidos (Histórico de Correções)
*   **Match Semântico Falho:** Resolvido com Sliding Window (Janela Deslizante).
*   **Falsos Positivos VAD:** Resolvido aumentando o threshold de energia.
*   **Erro de Sintaxe `Unexpected "}"`:** Resolvido.
*   **INP (Interface Travando):** Resolvido com AudioWorklet buffer 4096.

---

## 5. Próximos Passos (Roadmap Técnico)
Para a próxima tarefa, seguir esta ordem sem quebrar o anterior:

1.  **Refatoração para VAD Híbrido:**
    *   Mover a detecção de silêncio (VAD) para dentro do `suse-audio-processor.js` (Worklet).
2.  **Backend Python (Railway):**
    *   Conectar o fluxo de áudio para validação biométrica secundária.
3.  **Testes E2E:**
    *   Criar testes automatizados.

---

**Instrução para a IA na Próxima Sessão:**
"LEIA ESTE ARQUIVO (`MASTER_PROJECT_STATE.md`) ANTES DE QUALQUER AÇÃO. O sistema de voz e SOS está na versão v1.3.39 (Otimizada). Não reverta para thresholds baixos de VAD nem remova a lógica de Sliding Window."
