# Caderno Técnico: Sistema de Emergência por Voz e Monitoramento (SUSE-DF)

**Data de Atualização:** 04/02/2026
**Versão do Documento:** 1.0
**Status do Sistema:** Funcional (Homologação)

---

## 1. Visão Geral do Sistema

O módulo de Emergência por Voz é um componente crítico do sistema SUSE-DF, projetado para permitir que motoristas em situações de risco acionem um alerta de socorro de forma "mãos-livres" (hands-free) e discreta. O sistema utiliza tecnologias nativas de reconhecimento de fala para monitorar o ambiente e detectar uma **Frase de Segurança (Secret Word)** pré-configurada pelo usuário.

### 1.1 Objetivo
Garantir o acionamento rápido e seguro de ocorrências de emergência sem a necessidade de interação física com a tela do dispositivo, aumentando a segurança do condutor em cenários de coação.

---

## 2. Especificações Técnicas e Funcionalidades

### 2.1 Configuração de Voz e Biometria
O processo de *onboarding* de voz é realizado através do componente `VoiceConfig.jsx`.

*   **Coleta de Amostras:** O sistema solicita ao usuário a gravação de 4 áudios distintos:
    1.  **Frase 1 (Biometria):** "O sistema de segurança está ativo"
    2.  **Frase 2 (Biometria):** "Minha voz é minha identidade"
    3.  **Frase 3 (Biometria):** "Autorização confirmada pelo motorista"
    4.  **Frase Secreta:** Uma frase livre escolhida pelo usuário (ex: "carro azul enguiçou").
*   **Validação:** A frase secreta deve conter no mínimo **2 palavras** para reduzir falsos positivos.
*   **Armazenamento de Áudio:**
    *   **Formato:** WebM (`audio/webm`).
    *   **Local:** Supabase Storage (Bucket: `voice-recordings`).
    *   **Nomenclatura:** `{user_id}/biometry_1.webm`, `{user_id}/emergency_phrase.webm`, etc.
*   **Persistência de Dados:**
    *   A frase secreta (texto) é salva na coluna `secret_word` da tabela `users`.
    *   As URLs públicas dos áudios são salvas nas colunas `voice_biometry_X_url` e `secret_word_audio_url`.

### 2.2 Monitoramento Ativo (Keyword Spotting)
O monitoramento ocorre no Painel do Condutor (`Dashboard.jsx`), através do componente `VoiceEmergencyListener.jsx`.

*   **Tecnologia:** Web Speech API (`SpeechRecognition`).
*   **Modo de Operação:**
    *   **Contínuo (`continuous: true`):** O microfone permanece aberto enquanto o motorista está no painel.
    *   **Tempo Real (`interimResults: true`):** Processa a fala conforme ela acontece, sem esperar pausas.
    *   **Idioma:** Português Brasil (`pt-BR`).
*   **Algoritmo de Detecção:**
    *   **Janela Deslizante (Sliding Window):** O sistema analisa o fluxo contínuo de palavras buscando a sequência exata da frase secreta.
    *   **Fuzzy Matching (Tolerância):** Utiliza o algoritmo de **Distância de Levenshtein** para calcular a similaridade entre o que foi ouvido e a frase alvo.
    *   **Limiar de Ativação:** O alerta é disparado se a similaridade for superior a **60% (0.6)**, permitindo pequenas variações de pronúncia ou sotaque.

### 2.3 Acionamento da Emergência
Uma vez detectada a frase de segurança, o sistema executa o protocolo de emergência (`handleSOS`):

1.  **Feedback Discreto:** O aparelho vibra (`navigator.vibrate`) para confirmar o acionamento sem emitir sons.
2.  **Registro da Ocorrência:**
    *   Cria um registro na tabela `emergency_alerts`.
    *   **Tipo de Gatilho:** Define `trigger_type = 'voice'` para auditoria forense.
    *   **Status:** Define como `active`.
3.  **Geolocalização:** Captura as coordenadas GPS (Latitude/Longitude) instantâneas.
4.  **Rastreamento em Tempo Real:**
    *   Inicia um *loop* de envio de localização a cada **5 segundos**.
    *   Os dados são gravados na tabela `location_updates`.
5.  **Interface de Emergência:** A tela do motorista muda para o "Modo de Segurança" (Interface escura/vermelha ou camuflada), bloqueando a navegação comum até que a ocorrência seja finalizada.

---

## 3. Parametrizações de Banco de Dados (Supabase)

### 3.1 Tabela `users`
Campos adicionados para suporte à funcionalidade:
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `secret_word` | TEXT | A frase de segurança em texto plano. |
| `secret_word_audio_url` | TEXT | URL do áudio da frase secreta. |
| `voice_biometry_1_url` | TEXT | URL da amostra biométrica 1. |
| `voice_biometry_2_url` | TEXT | URL da amostra biométrica 2. |
| `voice_biometry_3_url` | TEXT | URL da amostra biométrica 3. |

### 3.2 Tabela `emergency_alerts`
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `trigger_type` | TEXT | Origem do alerta: `'voice'` ou `'button'`. |
| `status` | TEXT | Estado atual: `'active'`, `'resolved'`, `'investigating'`. |

### 3.3 Storage Buckets
*   **`voice-recordings`**: Bucket privado (com políticas RLS) para armazenar os áudios de configuração. Apenas o próprio usuário e a equipe de Staff podem acessar.

---

## 4. Fluxo de Dados e Segurança

1.  **Captura:** O navegador do cliente captura o áudio localmente. NENHUM áudio é enviado para a nuvem para *processamento* contínuo (o reconhecimento de fala roda no dispositivo/navegador), garantindo privacidade.
2.  **Validação:** A comparação de texto é feita localmente no JavaScript do cliente.
3.  **Persistência:** Apenas os metadados do alerta (localização, timestamp, tipo de gatilho) são enviados ao servidor Supabase quando uma emergência é confirmada.

---

## 5. Limitações Conhecidas e Melhorias Futuras

*   **Dependência do Navegador:** O reconhecimento de voz depende da implementação da Web Speech API do navegador (funciona melhor no Chrome/Android).
*   **Biometria Real:** A verificação de *identidade* do falante (saber *quem* falou, não apenas *o que* foi falado) está preparada na arquitetura (`VoiceBiometryService`), mas opera atualmente em modo "pass-through". A integração com um motor de biometria Python (ex: via Edge Edge Functions) é o próximo passo previsto.
*   **Conectividade:** O envio do alerta requer conexão com a internet. Em modo offline, o sistema pode não conseguir registrar a ocorrência imediatamente.

---

**Elaborado por:** Assistente de Desenvolvimento Trae AI
**Para:** Equipe de Engenharia e Produto SUSE-DF
