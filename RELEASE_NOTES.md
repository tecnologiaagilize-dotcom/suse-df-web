# Release Notes - v1.3.5 (Interface Gauge v3.0)

## 📊 Nova Interface de Monitoramento

Esta versão introduz o **Monitoramento Estilo Gauge (Agulha)** para o IRA-SUSI, facilitando a leitura rápida dos níveis de risco.

### Alterações Principais:

#### 1. Interface de Monitoramento (Gauge Linear)
*   **Fundo Segmentado**: A barra de risco agora é fixa e dividida em 3 zonas de cor:
    *   🟩 **Seguro (0-40%)**: Zona Verde.
    *   🟨 **Atenção (40-75%)**: Zona Amarela.
    *   🟥 **Risco Crítico (75-100%)**: Zona Vermelha.
*   **Indicador Móvel**: Uma agulha (marcador branco) se move sobre as zonas coloridas indicando o nível exato de stress acústico em tempo real.

#### 2. Protocolo de Impacto (Reforço)
*   Implementada priorização de **WhatsApp** em caso de colisão detectada.
*   Log de auditoria explícito para eventos de impacto.

### Versões dos Componentes:
*   **App Web**: v1.3.5
*   **IRA-SUSI Engine**: v1.1-official (Strict Mode)
