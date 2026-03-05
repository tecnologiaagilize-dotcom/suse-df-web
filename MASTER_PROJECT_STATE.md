# SUSE-DF Project Master Plan & Handover Documentation
**Versão Atual:** v1.3.40 (Unified Stream Architecture)
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

### A. Monitoramento de Voz (IRA-SUSI v1.3.40)
*   **Arquivo Principal:** `apps/web/src/components/voice/VoiceEmergencyListener.jsx`
*   **Processador de Áudio:** `apps/web/public/workers/suse-audio-processor.js`
*   **Melhorias v1.3.40 (Unified Stream):**
    *   **Arquitetura de Stream Único:** O `getUserMedia` é chamado apenas uma vez no `VoiceEmergencyListener`. O objeto `MediaStream` resultante é injetado no `VoiceActivityService` (VAD) e no `AudioStreamingService`.
    *   **Benefício:** Elimina conflitos de hardware em Android/iOS ("Device in use") onde múltiplos processos tentando acessar o microfone causavam falha no VAD ou no reconhecimento de fala.
*   **Melhorias v1.3.39 (Compliance):**
    *   **Sample Rate 48kHz:** Otimizado para qualidade de análise semântica.
    *   **Sliding Window Match:** Busca por janela deslizante (20 palavras).
    *   **VAD Threshold:** 45 (Nativo).

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
*   **Conflito de Microfone (Mobile/Android):** Resolvido com Unified Stream Architecture (v1.3.40).
*   **Build Error (processedSource):** Resolvido removendo declaração duplicada.
*   **Match Semântico Falho:** Resolvido com Sliding Window.
*   **Falsos Positivos VAD:** Resolvido aumentando o threshold de energia.

---

## 5. Próximos Passos (Roadmap Técnico)
Para a próxima tarefa, seguir esta ordem sem quebrar o anterior:

1.  **Backend Python (Railway):**
    *   Conectar o fluxo de áudio para validação biométrica secundária.
2.  **Testes E2E:**
    *   Criar testes automatizados.

---

**Instrução para a IA na Próxima Sessão:**
"LEIA ESTE ARQUIVO (`MASTER_PROJECT_STATE.md`) ANTES DE QUALQUER AÇÃO. O sistema de voz usa Arquitetura de Stream Unificado (v1.3.40). NÃO adicione chamadas extras de `getUserMedia` no VAD ou Listener."
