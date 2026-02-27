# Release Notes - v1.2 (IRA-SUSI v1.1 Unified)

## 🚨 Atualização de Interface e Estabilidade

Esta versão simplifica a visualização de risco e mantém o **Strict Mode** do IRA-SUSI v1.1.

### Alterações Principais:

#### 1. Interface de Monitoramento Simplificada (Barra Única)
*   Substituição das barras em cascata por uma **Barra de Progresso Unificada**.
*   **Comportamento Dinâmico**:
    *   **Verde (Normal)**: 0% - 40%
    *   **Amarelo (Atenção)**: 40% - 75%
    *   **Vermelho (Em Risco)**: > 75%
    *   **Animação de Pulso**: > 88% (Iminência de Disparo)

#### 2. Eliminação de Falsos Positivos (Strict Mode - Mantido)
*   **Regra de Gatilho Único**: O acionamento automático exige estritamente:
    1.  **Biometria Confirmada** (`isVerified: true`); OU
    2.  **Matriz de Risco Físico Confirmada**: Impacto Físico (>25m/s²) + Stress Acústico; OU
    3.  **Risco Acústico Extremo**: IRA > 0.92.

#### 3. Parametrização de Sensores (v1.1 - Mantido)
*   **Acelerômetro**: Threshold de impacto em **25.0 m/s²** (aprox. 2.5G).

### Versões dos Componentes:
*   **App Web**: v1.2
*   **IRA-SUSI Engine**: v1.1-official
*   **Sensor Context**: v3.1
