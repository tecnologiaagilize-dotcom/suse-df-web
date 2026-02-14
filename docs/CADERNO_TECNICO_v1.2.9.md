# Caderno Técnico - Versão 1.2.9
**Data de Release:** 14/02/2026
**Autor:** Agilize Tecnologia (Trae AI)

---

## 🚀 Visão Geral
Esta versão foca na consolidação do **Ecossistema de Saúde e Segurança (SUSE-DF)**, expandindo as funcionalidades para o passageiro, integrando o Painel do Profissional de Saúde e estabelecendo o fluxo completo de atendimento de emergência via QR Code.

## 🆕 Novas Funcionalidades Implementadas

### 1. Módulo de Saúde Expandido
*   **Painel Unificado:** Passageiros e Condutores agora compartilham a mesma interface robusta de gestão de saúde (`HealthProfile.jsx`).
*   **Identidade Visual:** Botão "Minha Saúde" padronizado com ícone de coração pulsante ❤️.
*   **Dados Coletados:**
    *   Ficha Médica (Tipo Sanguíneo, Alergias, Medicamentos).
    *   Contatos de Emergência.
    *   Cartão SUS e Plano de Saúde.
    *   Status de Doador de Órgãos.

### 2. Segurança e Monitoramento
*   **Cerca Virtual (Geofence) para Passageiros:** 
    *   Funcionalidade portada do app do motorista.
    *   Permite definir perímetro de segurança com alertas automáticos.
    *   Identidade visual na cor **Verde** (Segurança) para diferenciar da Saúde (Vermelho).
*   **Botão de Pânico (SOS):** Mantido e integrado.

### 3. Painel do Profissional de Saúde (Novo)
*   **Acesso Dedicado:** Rota `/professional/dashboard` exclusiva.
*   **Login por Matrícula:** Autenticação simplificada para socorristas (ex: `123456@suse.pro`).
*   **Scanner de QR Code:** Leitor integrado (`@yudiel/react-qr-scanner`) para acesso rápido a prontuários.
*   **Prontuário Eletrônico (EHR):**
    *   Visualização completa do histórico do paciente.
    *   Aba de "Novo Registro" para evolução médica e sinais vitais.

### 4. Fluxo de Acesso via QR Code (HealthAccessGuard)
*   **Tela de Decisão:** Ao ler o QR Code, o sistema pergunta:
    *   🕵️‍♂️ **Profissional:** Redireciona para Login -> Prontuário Completo.
    *   🆘 **Socorrista Civil:** Redireciona para Ficha de Emergência Pública.
*   **Botão de Regeração:** Passageiro pode invalidar QR Codes antigos e gerar novos instantaneamente.

---

## 🛠️ Alterações Técnicas

### Frontend
*   **Rotas:** Novas rotas protegidas `/professional/*` e `/health/check/:token`.
*   **Componentes:**
    *   `HealthAccessGuard.jsx`: Controlador de fluxo de acesso.
    *   `ProfessionalDashboard.jsx`: Dashboard médico.
    *   `PatientRecord.jsx`: Prontuário eletrônico.
    *   `QRScanner.jsx`: Leitor de câmera.
*   **Dependências:** Adicionada `@yudiel/react-qr-scanner`.

### Backend (Supabase)
*   **RPC:** `get_public_health_info` (Acesso público).
*   **Tabelas:** `health_audit_logs` para rastreabilidade de acessos.
*   **Segurança:** Scripts SQL para permissões de leitura pública (`anon`) em tokens ativos.

---

## 🐛 Bugs Conhecidos e Limitações

### 1. Leitura de QR Code por Socorrista Civil (Público)
*   **Sintoma:** Ao selecionar "Não / Socorrista Civil" na tela de verificação, o sistema retorna erro de "Acesso Negado" ou falha de conexão com o servidor RPC.
*   **Causa Provável:** As políticas RLS (Row Level Security) ou as permissões de execução da função RPC para o papel `anon` não foram propagadas corretamente no ambiente de produção/preview.
*   **Status:** **Pendente de Correção**.
*   **Workaround:** O acesso Profissional funciona corretamente. O passageiro pode visualizar seus próprios dados logado.

### 2. Login Profissional (Simulado)
*   Atualmente, o login aceita qualquer matrícula que tenha sido previamente cadastrada como email no formato `{matricula}@suse.pro`. Em produção, deve ser integrado ao LDAP ou base de RH do GDF.

---

## 📂 Estrutura de Backup
Um backup completo do código fonte (`src`) desta versão foi salvo em:
`./backups/v1.2.9/src`

---

**Fim do Relatório**
