# Proposta de Otimização Estratégica: IRA-SUSE Pro

## 1. Introdução
Após a análise dos módulos de biometria, impacto e áudio WebRTC, esta proposta visa elevar o sistema **IRA-SUSE** ao patamar de excelência em missão crítica. As sugestões focam em três pilares: **Latência Zero**, **Inteligência de Borda (Edge AI)** e **Resiliência Extrema**.

## 2. Otimização de Biometria: Edge AI First
Atualmente, a biometria de voz depende de processamento que pode ser afetado pela latência de rede. A transição para um modelo **On-Device (Edge AI)** oferece benefícios imediatos.

| Técnica | Descrição | Impacto na Eficiência |
| :--- | :--- | :--- |
| **Inferência Local** | Executar o `SpeakerMatch` diretamente no dispositivo móvel usando modelos quantizados (TFLite/CoreML). | Redução da latência de validação de ~300ms para < 50ms. |
| **VAD (Voice Activity Detection)** | Filtro de silêncio local para enviar apenas áudio útil para a Central. | Economia de até 40% de largura de banda e bateria. |
| **Biometria Contínua** | Validação em segundo plano durante a chamada live para detectar troca de orador. | Aumento crítico na segurança da cadeia de custódia. |

## 3. Otimização WebRTC: Arquitetura Híbrida
Embora o SFU (mediasoup) seja excelente para múltiplos ouvintes, em emergências 1:1, uma abordagem híbrida pode ser mais eficiente.

-   **P2P Fallback:** Implementar uma tentativa inicial de conexão Peer-to-Peer (P2P) para reduzir a carga no servidor Railway e minimizar a latência para < 100ms em redes locais ou 4G estáveis.
-   **Dynamic Bitrate (Opus VBR):** Configurar o codec Opus para operar em modo de voz de banda estreita (6-12 kbps) em condições de sinal fraco, garantindo que a voz chegue à Central mesmo em conexões 2G/Edge.

## 4. Resiliência de Dados: "Black Box" Local
Para garantir que nenhuma evidência seja perdida em caso de destruição do dispositivo ou queda total de sinal:

1.  **Buffer de Pré-Roll Circular:** Manter os últimos 30 segundos de áudio em memória RAM criptografada, realizando o *flush* imediato para o Supabase assim que um impacto for detectado (mesmo antes da validação da voz).
2.  **Sincronização Delta:** Em vez de reenviar segmentos inteiros em caso de falha, enviar apenas os "deltas" (diferenças) ou metadados de integridade para economizar dados.

## 5. Inteligência de Impacto: Fusão de Sensores Avançada
O `ImpactFlag` pode ser otimizado para reduzir falsos positivos (como quedas acidentais do celular).

-   **Análise de Áudio + Acelerômetro:** Validar o impacto físico com o som característico de colisão (análise espectral de alta frequência).
-   **Detecção de "Grito de Socorro":** Um modelo de TinyML local que reconhece padrões de frequência de gritos humanos, elevando o estado de alerta instantaneamente.

---
> **Conclusão:** A implementação destas melhorias transformará o IRA-SUSE em um sistema proativo e resiliente, capaz de operar em condições extremas de conectividade e hardware.
