# Release Notes - v1.3.3 (IRA-SUSI v1.1 Strict Compliance)

## 🚨 Atualização Crítica de Estabilidade

Esta versão implementa o **Strict Mode** do IRA-SUSI v1.1 para eliminar falsos positivos no sistema de monitoramento de emergência.

### Alterações Principais:

#### 1. Eliminação de Falsos Positivos (Strict Mode)
*   **Remoção de Fail-Safes**: O sistema não aciona mais a central em caso de "Falha de Backend" ou "Ambiente Calmo" sem confirmação biométrica.
*   **Regra de Gatilho Único**: O acionamento automático agora exige estritamente:
    1.  **Biometria Confirmada** (`isVerified: true`); OU
    2.  **Matriz de Risco Físico Confirmada**: Impacto Físico (>25m/s²) + Stress Acústico (Grito/Pânico); OU
    3.  **Risco Acústico Extremo**: IRA > 0.92 (Barra de Risco > 80%).

#### 2. Parametrização de Sensores (v1.1)
*   **Acelerômetro**: Threshold de impacto aumentado de 15.0 para **25.0 m/s²** (aprox. 2.5G).
    *   *Objetivo*: Filtrar lombadas, buracos e freadas bruscas que causavam disparos indevidos.

#### 3. Interface de Monitoramento (Cascata)
*   Implementação das **Barras de Risco em Cascata** nos Dashboards de Motorista e Passageiro:
    *   🟢 **Normal**: 0% a 40% (Monitoramento Base)
    *   🟡 **Atenção**: Inicia apenas quando Normal > 70%
    *   🔴 **Em Risco**: Inicia apenas quando Atenção > 70%
    *   ⚠️ **Gatilho**: Acionamento automático se "Em Risco" atingir nível crítico.

### Versões dos Componentes:
*   **App Web**: v1.3.3
*   **IRA-SUSI Engine**: v1.1-official
*   **Sensor Context**: v3.1
