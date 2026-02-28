# Checklist de Validação IRA-SUSI v1.0

Este documento orienta a validação de campo do algoritmo IRA-SUSI conforme a especificação técnica oficial.

## 1. Testes de Ambiente (Baseline)
- [ ] **Indoor Silencioso (Escritório/Casa)**
  - O sistema deve estabilizar em **NORMAL**.
  - IRA esperado: < 0.20
  - Verifique se o `g2` (Noise Gate) está próximo de 1.0 (baixo ruído).

- [ ] **Urbano Movimentado (Rua)**
  - O sistema deve manter **NORMAL** ou oscilar levemente para **ATENCAO**.
  - O baseline de energia deve subir (ex: -30dBFS -> -20dBFS).
  - Verifique se o `g2` diminui (penalizando o ruído de fundo).
  - Métrica Alvo: Menos de 1 Falso Positivo (RISCO) a cada 3 horas.

## 2. Testes de Cenário
- [ ] **Detecção de Veículo**
  - Simule velocidade > 15km/h (se possível injetar dados de GPS ou testar em movimento).
  - Verifique se o Cenário muda para `VEHICLE` no Debug Panel.
  - Thresholds devem subir (ficar mais difícil disparar).

- [ ] **Detecção Indoor vs Urban**
  - Em local silencioso e parado: Cenário `INDOOR`.
  - Em local ruidoso ou em movimento lento: Cenário `URBAN`.

## 3. Testes de Eventos (Disparo)
- [ ] **Grito Simulado**
  - Produza um som alto e agudo (Grito).
  - O `phi.scream` deve ir para 1.0.
  - O estado deve pular rapidamente para **EMERGENCIA** ou **RISCO**.
  - Latência esperada: < 150ms.
  - Métrica Alvo: FN (Falso Negativo) < 5% para gritos reais.

- [ ] **Ataque Repentino (Explosão/Batida)**
  - Gere um som de impacto forte (palma forte próxima ou batida na mesa).
  - Verifique se `deltaEnergy` dispara.
  - O IRA deve subir abruptamente (Ataque rápido do smoothing).

- [ ] **Fala Normal (Conversa)**
  - Converse normalmente próximo ao microfone.
  - O sistema NÃO deve passar de **ATENCAO**.
  - O `pitchZScore` deve variar, mas dentro do esperado.

## 4. Testes de Segurança
- [ ] **Anti-Replay**
  - Tente reproduzir um áudio gravado de grito.
  - O sistema deve disparar (o IRA-SUSI acústico detecta o som, a biometria é que barraria o comando de voz, mas o risco acústico é agnóstico de biometria na fase 1).
  - *Nota:* A especificação diz "Anti-replay" como teste obrigatório, verifique se a biometria (Qt) reduz o score se a liveness falhar (se integrado).

## 5. Estabilidade
- [ ] **Freeze Pós-Evento**
  - Após um disparo de EMERGENCIA, faça silêncio.
  - O sistema deve manter o estado visual ou o baseline congelado por alguns segundos (Freeze Duration) antes de cair para NORMAL.
  - Isso evita oscilação ("flickering") entre estados.

## Como Monitorar
Utilize o **IraDebugPanel** (canto inferior direito da tela):
1. Observe a barra de **IRA** (Risco).
2. Veja os valores crus de **RMS (dBFS)** e **Pitch**.
3. Confirme o **Cenário** detectado.
4. Veja se o **Status** muda conforme esperado.
